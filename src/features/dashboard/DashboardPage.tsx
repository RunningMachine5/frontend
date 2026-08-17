import type {
  DashboardAgentInsight,
  DistributionItem,
  PriorityTrendPoint,
} from "./dashboardOverviewTypes";
import { AppLayout } from "../../components/layout/AppLayout";
import { useDashboardOverview } from "./useDashboardOverview";
import "./DashboardPage.css";

const TEST_PERIOD = {
  periodStart: "2025-01-01T00:00:00+09:00",
  periodEnd: "2025-01-06T00:00:00+09:00",
};

const metricColors = ["purple", "orange", "red", "pink", "green"] as const;
const riskColors = ["#ee4047", "#f49121", "#7a49dc", "#3ec887"];
const agentColors = ["#ee4047", "#f49121", "#b640be", "#7a49dc", "#3ec887"];

type AgentChartItem = { label: string; value: number };

function formatNumber(value: number) {
  return value.toLocaleString("ko-KR");
}

function formatMoney(value: number) {
  return `${formatNumber(value)}원`;
}

function formatCompactMoney(value: number) {
  return value >= 1_000_000
    ? `₩${(value / 1_000_000).toFixed(1)}M`
    : formatMoney(value);
}

function formatDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : `${date.getMonth() + 1}/${date.getDate()}`;
}

function toAgentItems(insight: DashboardAgentInsight | null): AgentChartItem[] {
  const spec = insight?.chart_spec;
  if (!spec || !Array.isArray(spec.items)) return [];

  return spec.items
    .map((item): AgentChartItem | null => {
      if (!item || typeof item !== "object") return null;
      const source = item as Record<string, unknown>;
      const value = source.current_count ?? source.increase_count;

      return typeof source.label === "string" && typeof value === "number"
        ? { label: source.label, value }
        : null;
    })
    .filter((item): item is AgentChartItem => item !== null)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

function TrendChart({ points }: { points: PriorityTrendPoint[] }) {
  const width = 760;
  const height = 170;
  const padding = { top: 18, right: 18, bottom: 30, left: 34 };
  const maxValue = Math.max(...points.map((point) => point.total_count), 1);
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const coordinates = points.map((point, index) => ({
    x:
      padding.left +
      (points.length > 1
        ? (chartWidth * index) / (points.length - 1)
        : chartWidth / 2),
    y: padding.top + chartHeight - (point.total_count / maxValue) * chartHeight,
    point,
  }));
  const line = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");
  const lastPoint = coordinates[coordinates.length - 1];
  const area = coordinates.length
    ? `${padding.left},${padding.top + chartHeight} ${line} ${lastPoint.x},${padding.top + chartHeight}`
    : "";

  return (
    <div className="trend-chart-wrap">
      <svg
        aria-label="날짜별 고위험 이상거래 발생 추이"
        className="trend-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
      >
        <defs>
          <linearGradient id="priority-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#b640be" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#b640be" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.33, 0.66, 1].map((ratio) => {
          const y = padding.top + chartHeight * ratio;
          return (
            <g key={ratio}>
              <line
                stroke="#2e2e38"
                strokeWidth="1"
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
              />
              <text className="chart-axis" textAnchor="end" x={padding.left - 10} y={y + 4}>
                {Math.round(maxValue * (1 - ratio))}
              </text>
            </g>
          );
        })}
        {area && <polygon fill="url(#priority-area)" points={area} />}
        {line && (
          <polyline
            fill="none"
            points={line}
            stroke="#b640be"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
        )}
        {coordinates.map(({ x, y, point }) => (
          <g key={point.date}>
            <circle cx={x} cy={y} fill="#121217" r="5" stroke="#b640be" strokeWidth="3" />
            <text className="chart-value" textAnchor="middle" x={x} y={y - 12}>
              {point.total_count}
            </text>
            <text className="chart-axis" textAnchor="middle" x={x} y={height - 7}>
              {point.date}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function RiskDistribution({ items }: { items: DistributionItem[] }) {
  const maxCount = Math.max(...items.map((item) => item.count), 1);

  return (
    <div className="risk-list">
      {items.map((item, index) => (
        <div className="risk-row" key={item.label}>
          <span className="risk-label">{item.label}</span>
          <div className="bar-track">
            <span
              className="bar-fill"
              style={{
                backgroundColor: riskColors[index % riskColors.length],
                width: `${(item.count / maxCount) * 100}%`,
              }}
            />
          </div>
          <span className="risk-detail">
            {formatNumber(item.count)}건 / {formatCompactMoney(item.amount)}
          </span>
        </div>
      ))}
    </div>
  );
}

function SuspiciousBars({
  points,
}: {
  points: { date: string; suspicious_count: number; suspicious_amount: number }[];
}) {
  const maxCount = Math.max(...points.map((point) => point.suspicious_count), 1);
  const amount = points.reduce((sum, point) => sum + point.suspicious_amount, 0);

  return (
    <>
      <div className="mini-chart-meta">
        <span>의심 금액</span>
        <strong>{formatCompactMoney(amount)}</strong>
      </div>
      <div className="mini-bars">
        {points.map((point) => (
          <div className="mini-bar-column" key={point.date}>
            <strong>{point.suspicious_count}</strong>
            <div className="mini-bar-area">
              <span
                className="mini-bar"
                style={{
                  height: `${Math.max(
                    (point.suspicious_count / maxCount) * 100,
                    4,
                  )}%`,
                }}
              />
            </div>
            <span>{point.date}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function ChannelBubbles({ items }: { items: DistributionItem[] }) {
  const topItems = [...items].sort((a, b) => b.count - a.count).slice(0, 4);
  const maxCount = Math.max(...topItems.map((item) => item.count), 1);
  const positions = [
    { left: "18%", top: "48%" },
    { left: "48%", top: "34%" },
    { left: "72%", top: "53%" },
    { left: "58%", top: "73%" },
  ];

  return (
    <div className="bubble-stage">
      {topItems.map((item, index) => {
        const size = 42 + Math.sqrt(item.count / maxCount) * 72;
        const position = positions[index] ?? positions[positions.length - 1];

        return (
          <div
            className={`bubble bubble-${index}`}
            key={item.label}
            style={{ ...position, height: size, width: size }}
            title={`${item.label}: ${formatNumber(item.count)}건 / ${formatMoney(item.amount)}`}
          >
            <strong>{item.label}</strong>
            <span>{formatNumber(item.count)}건</span>
          </div>
        );
      })}
      <div className="bubble-legend">
        {topItems.map((item, index) => (
          <span key={item.label}>
            <i className={`bubble-dot bubble-${index}`} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function AgentInsight({ insight }: { insight: DashboardAgentInsight | null }) {
  const items = toAgentItems(insight);
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <section className="panel agent-panel">
      <div className="agent-panel-head">
        <div>
          <p className="eyebrow">DASHBOARD INSIGHT AGENT</p>
          <h2>{insight?.title ?? "AI Agent 분석 · 룰/이상징후 조합 TOP 5"}</h2>
          <p className="panel-caption">분석 기간 기준 · 원인 확정이 아닌 증가 후보</p>
        </div>
        <span className="status-badge"><i />최신 분석 완료</span>
      </div>
      {items.length > 0 ? (
        <div className="agent-bars">
          {items.map((item, index) => (
            <div className="agent-row" key={item.label}>
              <span>{item.label}</span>
              <div className="bar-track">
                <i
                  className="bar-fill"
                  style={{
                    backgroundColor: agentColors[index % agentColors.length],
                    width: `${(item.value / maxValue) * 100}%`,
                  }}
                />
              </div>
              <strong>{formatNumber(item.value)}</strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="agent-empty">생성된 조합 데이터가 아직 없습니다.</div>
      )}
      <div className="agent-summary">
        <strong>AI Agent 자연어 요약</strong>
        <p>{insight?.summary ?? "아직 생성된 AI Agent Insight가 없습니다."}</p>
        <span>
          {insight ? `생성 시각 · ${formatDate(insight.created_at)}` : "Insight 생성 후 요약이 표시됩니다."}
        </span>
      </div>
    </section>
  );
}

export function DashboardPage() {
  const { data, isLoading, errorMessage } = useDashboardOverview(TEST_PERIOD);

  if (isLoading && !data) {
    return <main className="dashboard-state">대시보드를 불러오는 중...</main>;
  }
  if (errorMessage && !data) {
    return <main className="dashboard-state">오류: {errorMessage}</main>;
  }
  if (!data) {
    return <main className="dashboard-state">표시할 데이터가 없습니다.</main>;
  }

  const metrics = [
    { label: "분석 거래", value: `${formatNumber(data.summary.total_transaction_count)}건`, note: "선택 기간 전체 거래" },
    { label: "의심 거래", value: `${formatNumber(data.summary.suspicious_transaction_count)}건`, note: "ML·룰 분석 대상" },
    { label: "우선 검토", value: `${formatNumber(data.summary.priority_review_count)}건`, note: "VERY_HIGH + HIGH" },
    { label: "의심 거래 금액", value: formatCompactMoney(data.summary.suspicious_amount), note: "사기 의심 총 금액" },
    { label: "Rule 분석 완료", value: `${formatNumber(data.summary.rule_analysis_completed_count)}건`, note: "분석 완료 거래" },
  ];
  const priorityPeak = Math.max(...data.priority_trend.map((point) => point.total_count), 0);

  return (
    <AppLayout activeNav="dashboard">
      <div className="dashboard-content" id="main">
        <header className="dashboard-header">
          <div><p className="eyebrow">LIVE OPERATIONS</p><h1>FDS 통합 모니터링</h1><p>실시간 위험 신호와 분석 결과를 한 화면에서 확인합니다</p></div>
          <div className="header-actions">
            <div className="period-pill"><span>분석 기간</span><strong>{formatDate(data.period.period_start)} — {formatDate(data.period.period_end)}</strong></div>
            <div className="live-pill"><i />SSE 실시간 연결됨</div>
          </div>
        </header>
        {errorMessage && <p className="refresh-error">최근 갱신 실패: {errorMessage}</p>}

        <section className="metric-grid">
          {metrics.map((metric, index) => (
            <article className={`metric-card ${metricColors[index]}`} key={metric.label}>
              <span>{metric.label}</span><strong>{metric.value}</strong><small><i />{metric.note}</small>
            </article>
          ))}
        </section>

        <section className="top-grid">
          <article className="panel priority-panel">
            <div className="panel-head">
              <div><h2>고위험 이상거래 발생 추이</h2><p className="panel-caption">HIGH 이상 거래의 일별 집중도를 확인합니다</p></div>
              <span className="trend-badge"><i />최고 {formatNumber(priorityPeak)}건</span>
            </div>
            <div className="chart-legend"><span><i />VERY_HIGH + HIGH</span><em>거래 건수 (건)</em></div>
            <TrendChart points={data.priority_trend} />
          </article>
          <article className="panel risk-panel">
            <h2>위험등급별 의심거래</h2><p className="panel-caption">표시: 거래 건수 / 의심 금액</p>
            <RiskDistribution items={data.risk_grade_distribution} />
            <footer>우선 검토 {formatNumber(data.summary.priority_review_count)}건 · 검토 필요 거래 기준</footer>
          </article>
        </section>

        <section className="bottom-grid">
          <div className="left-panels">
            <article className="panel suspicious-panel">
              <div className="panel-head"><div><h2>선택 기간 의심 거래 추이</h2><p className="panel-caption">의심 건수와 의심 금액을 함께 확인합니다</p></div><span className="trend-badge positive">선택 기간 기준</span></div>
              <SuspiciousBars points={data.suspicious_trend} />
            </article>
            <article className="panel channel-panel">
              <div className="panel-head"><div><h2>채널별 의심거래 노출도</h2><p className="panel-caption">원 크기: 의심 거래 건수 · 선택 기간 기준</p></div><strong>총 {formatNumber(data.summary.suspicious_transaction_count)}건</strong></div>
              <ChannelBubbles items={data.channel_distribution} />
            </article>
          </div>
          <AgentInsight insight={data.agent_insight} />
        </section>
      </div>
    </AppLayout>
  );
}
