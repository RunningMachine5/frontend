// 실시간 생긴 후 화면 렌더링

import { useDashboardOverview } from "./useDashboardOverview";

const TEST_PERIOD = {
  periodStart: "2025-01-01T00:00:00+09:00",
  periodEnd: "2025-01-06T00:00:00+09:00",
};

type BarItem = {
  label: string;
  value: number;
  description?: string;
};

function BarChart({ title, items }: { title: string; items: BarItem[] }) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <section style={sectionStyle}>
      <h2>{title}</h2>

      {items.map((item) => (
        <div key={item.label} style={{ marginBottom: "12px" }}>
          <div style={labelRowStyle}>
            <span>{item.label}</span>
            <span>
              {item.value.toLocaleString()}
              {item.description ? ` ${item.description}` : "건"}
            </span>
          </div>

          <div style={barBackgroundStyle}>
            <div
              style={{
                ...barStyle,
                width: `${(item.value / maxValue) * 100}%`,
              }}
            />
          </div>
        </div>
      ))}
    </section>
  );
}

export function DashboardPage() {
  const { data, isLoading, errorMessage } =
    useDashboardOverview(TEST_PERIOD);

  if (isLoading && !data) {
    return <main style={pageStyle}>대시보드를 불러오는 중...</main>;
  }

  if (errorMessage && !data) {
    return <main style={pageStyle}>오류: {errorMessage}</main>;
  }

  if (!data) {
    return <main style={pageStyle}>표시할 데이터가 없습니다.</main>;
  }

  const { summary } = data;

  return (
    <main style={pageStyle}>
      <header>
        <h1>FDS 통합 모니터링</h1>
        <p>
          분석 기간: {data.period.period_start} ~ {data.period.period_end}
        </p>
        <p>실시간 갱신</p>
      </header>

      {errorMessage && (
        <p style={{ color: "crimson" }}>
          최근 갱신 실패: {errorMessage}
        </p>
      )}

      <section style={cardGridStyle}>
        <article style={cardStyle}>
          <span>분석 거래</span>
          <strong>{summary.total_transaction_count.toLocaleString()}건</strong>
        </article>

        <article style={cardStyle}>
          <span>의심 거래</span>
          <strong>
            {summary.suspicious_transaction_count.toLocaleString()}건
          </strong>
        </article>

        <article style={cardStyle}>
          <span>우선 검토</span>
          <strong>{summary.priority_review_count.toLocaleString()}건</strong>
        </article>

        <article style={cardStyle}>
          <span>의심 거래 금액</span>
          <strong>{summary.suspicious_amount.toLocaleString()}원</strong>
        </article>

        <article style={cardStyle}>
          <span>Rule 분석 완료</span>
          <strong>
            {summary.rule_analysis_completed_count.toLocaleString()}건
          </strong>
        </article>
      </section>

      <BarChart
        title="우선 검토 대상 추이"
        items={data.priority_trend.map((point) => ({
          label: point.date,
          value: point.total_count,
          description: `건 (VERY_HIGH ${point.very_high_count} / HIGH ${point.high_count})`,
        }))}
      />

      <BarChart
        title="의심 거래 추이"
        items={data.suspicious_trend.map((point) => ({
          label: point.date,
          value: point.suspicious_count,
          description: `건 / ${point.suspicious_amount.toLocaleString()}원`,
        }))}
      />

      <BarChart
        title="위험등급별 의심 거래"
        items={data.risk_grade_distribution.map((item) => ({
          label: item.label,
          value: item.count,
          description: `건 / ${item.amount.toLocaleString()}원`,
        }))}
      />

      <BarChart
        title="채널별 의심 거래"
        items={data.channel_distribution.map((item) => ({
          label: item.label,
          value: item.count,
          description: `건 / ${item.amount.toLocaleString()}원`,
        }))}
      />

      <section style={sectionStyle}>
        <h2>AI Agent 자연어 요약</h2>

        {data.agent_insight ? (
          <>
            <h3>{data.agent_insight.title}</h3>
            <p>{data.agent_insight.summary}</p>
          </>
        ) : (
          <p>아직 생성된 AI Agent Insight가 없습니다.</p>
        )}
      </section>
    </main>
  );
}

const pageStyle = {
  maxWidth: "1200px",
  margin: "0 auto",
  padding: "24px",
  fontFamily: "Arial, sans-serif",
};

const cardGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px",
  margin: "24px 0",
};

const cardStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "8px",
  padding: "20px",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
};

const sectionStyle = {
  marginTop: "20px",
  padding: "20px",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
};

const labelRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  marginBottom: "4px",
};

const barBackgroundStyle = {
  height: "20px",
  backgroundColor: "#e5e7eb",
  borderRadius: "4px",
};

const barStyle = {
  height: "100%",
  backgroundColor: "#2563eb",
  borderRadius: "4px",
};