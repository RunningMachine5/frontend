import { useState } from "react";
import { AppLayout } from "../../components/layout/AppLayout";
import { PageHeading } from "../../components/layout/PageHeading";
import { AgentInsightPanel } from "./components/AgentInsightPanel";
import { ChannelDistributionPanel } from "./components/ChannelDistributionPanel";
import { DashboardSummaryCards } from "./components/DashboardSummaryCards";
import { HighRiskTrendPanel } from "./components/HighRiskTrendPanel";
import { RiskGradeDistributionPanel } from "./components/RiskGradeDistributionPanel";
import { formatCompactMoney } from "./dashboardFormatters";
import type { PriorityTrendPoint, SuspiciousTrendPoint } from "./dashboardOverviewTypes";
import { useDashboardOverview } from "./useDashboardOverview";
import "./DashboardPage.css";

function getCurrentDashboardPeriod() {
  const periodEnd = new Date();
  periodEnd.setHours(24, 0, 0, 0);

  const periodStart = new Date(periodEnd);
  periodStart.setDate(periodStart.getDate() - 6);

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  };
}

const CURRENT_PERIOD = getCurrentDashboardPeriod();

function SuspiciousTrendPanel({
  points,
  priorityPoints = [],
}: {
  points: SuspiciousTrendPoint[];
  priorityPoints?: PriorityTrendPoint[];
}) {
  const maxCount = Math.max(...points.map((point) => point.suspicious_count), 1);
  const totalAmount = points.reduce((sum, point) => sum + point.suspicious_amount, 0);
  const totalCount = points.reduce((sum, point) => sum + point.suspicious_count, 0);

  // 날짜별 우선순위(위험등급) 맵
  const priorityMap = new Map(priorityPoints.map((p) => [p.date, p]));

  return (
    <article className="panel suspicious-panel">
      <div className="panel-head">
        <div>
          <h2>최근 7일 의심 거래 추이</h2>
          <p className="panel-caption">각 날짜별 의심 건수와 의심 금액을 함께 확인합니다</p>
        </div>
        <div className="suspicious-panel-meta">
          <div className="grade-legend-mini" title="위험 등급: 심각(레드), 경고(오렌지), 주의(퍼플)">
            <span className="grade-legend-item"><i className="dot-critical" /> 심각</span>
            <span className="grade-legend-item"><i className="dot-high" /> 경고</span>
            <span className="grade-legend-item"><i className="dot-medium" /> 주의</span>
          </div>
          <div className="suspicious-amount">
            <span>7일 합계</span>
            <strong>{formatCompactMoney(totalAmount)}</strong>
            <small className="suspicious-count-tag">({totalCount}건)</small>
          </div>
        </div>
      </div>
      <div className="mini-bars-7days">
        {points.map((point) => {
          const heightPercent = Math.max((point.suspicious_count / maxCount) * 100, 8);
          const pri = priorityMap.get(point.date);

          // 위험 등급별 건수 계산
          const veryHigh = pri?.very_high_count ?? 0;
          const high = pri?.high_count ?? 0;
          const totalPriority = pri?.total_count ?? (veryHigh + high);
          const medium = Math.max(0, point.suspicious_count - totalPriority);

          const totalDayCount = point.suspicious_count > 0 ? point.suspicious_count : 1;
          const veryHighPct = (veryHigh / totalDayCount) * 100;
          const highPct = (high / totalDayCount) * 100;
          const mediumPct = (medium / totalDayCount) * 100;

          const tooltip = `${point.date} 의심 ${point.suspicious_count}건 (${formatCompactMoney(point.suspicious_amount)})\n- 심각: ${veryHigh}건\n- 경고: ${high}건\n- 주의: ${medium}건`;

          return (
            <div className="mini-bar-col-7days" key={point.date} title={tooltip}>
              <div className="bar-count-label">
                <strong>{point.suspicious_count}</strong>
                <span>건</span>
              </div>
              <div className="mini-bar-track-7days">
                <div
                  className="mini-bar-fill-7days stacked-bar-7days"
                  style={{ height: `${heightPercent}%` }}
                >
                  {veryHigh > 0 && (
                    <span
                      className="stack-segment segment-critical"
                      style={{ height: `${veryHighPct}%` }}
                      title={`심각: ${veryHigh}건`}
                    />
                  )}
                  {high > 0 && (
                    <span
                      className="stack-segment segment-high"
                      style={{ height: `${highPct}%` }}
                      title={`경고: ${high}건`}
                    />
                  )}
                  {medium > 0 && (
                    <span
                      className="stack-segment segment-medium"
                      style={{ height: `${mediumPct}%` }}
                      title={`주의: ${medium}건`}
                    />
                  )}
                  {veryHigh === 0 && high === 0 && medium === 0 && (
                    <span
                      className="stack-segment segment-medium"
                      style={{ height: "100%" }}
                    />
                  )}
                </div>
              </div>
              <span className="bar-amount-label">
                {formatCompactMoney(point.suspicious_amount)}
              </span>
              <span className="bar-date-label">{point.date}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export function DashboardPage() {
  const [period, setPeriod] = useState(CURRENT_PERIOD);
  const {
    data,
    isLoading,
    errorMessage,
    isRefreshingInsight,
    refreshAgentInsight,
  } = useDashboardOverview(period);

  const handleRefreshAgentInsight = async () => {
    // 현재 시각 기준 최근 7일(now - 7일 ~ now)로 기간 변경 및 최신 분석 실행
    const now = new Date();
    const currentEnd = new Date(now);
    const currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - 7);

    const newPeriod = {
      periodStart: currentStart.toISOString(),
      periodEnd: currentEnd.toISOString(),
    };

    setPeriod(newPeriod);
    try {
      await refreshAgentInsight(newPeriod);
    } catch {
      // 에러는 useDashboardOverview 내부에서 errorMessage로 처리됨
    }
  };

  if (isLoading && !data) return <main className="dashboard-state">대시보드를 불러오는 중...</main>;
  if (errorMessage && !data) return <main className="dashboard-state">오류: {errorMessage}</main>;
  if (!data) return <main className="dashboard-state">표시할 데이터가 없습니다.</main>;

  return (
    <AppLayout activeNav="dashboard">
      <div className="dashboard-content" id="main">
        <header className="app-page-header dashboard-header">
          <PageHeading eyebrow="FRAUD MONITORING" title="이상거래 감시" />
        </header>
        {errorMessage && <p className="refresh-error">최근 갱신 실패: {errorMessage}</p>}

        <DashboardSummaryCards summary={data.summary} />
        <section className="dashboard-monitoring-grid">
          {/* 상단 행: 실시간 위험 거래(넓게) + 최근 7일 추이(좁게) */}
          <div className="monitoring-top-row">
            <HighRiskTrendPanel
              points={data.priority_trend}
              suspiciousPoints={data.suspicious_trend}
            />
            <SuspiciousTrendPanel
              points={data.suspicious_trend}
              priorityPoints={data.priority_trend}
            />
          </div>

          {/* 하단 행: AI 에이전트(좁게) + 위험등급별 & 채널별(넓게) */}
          <div className="monitoring-bottom-row">
            <AgentInsightPanel
              insight={data.agent_insight}
              isRefreshing={isRefreshingInsight}
              onRefresh={handleRefreshAgentInsight}
            />
            <div className="bottom-right-col">
              <RiskGradeDistributionPanel
                items={data.risk_grade_distribution}
                summary={data.summary}
              />
              <ChannelDistributionPanel
                items={data.channel_distribution}
                totalCount={data.summary.suspicious_transaction_count}
              />
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
