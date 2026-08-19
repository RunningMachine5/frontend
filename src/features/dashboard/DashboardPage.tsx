import { AppLayout } from "../../components/layout/AppLayout";
import { LiveStatus } from "../../components/layout/LiveStatus";
import { PageHeading } from "../../components/layout/PageHeading";
import { AgentInsightPanel } from "./components/AgentInsightPanel";
import { ChannelDistributionPanel } from "./components/ChannelDistributionPanel";
import { DashboardSummaryCards } from "./components/DashboardSummaryCards";
import { HighRiskTrendPanel } from "./components/HighRiskTrendPanel";
import { RiskGradeDistributionPanel } from "./components/RiskGradeDistributionPanel";
import { formatCompactMoney } from "./dashboardFormatters";
import type { SuspiciousTrendPoint } from "./dashboardOverviewTypes";
import { useDashboardOverview } from "./useDashboardOverview";
import "./DashboardPage.css";

function getCurrentDashboardPeriod() {
  const periodEnd = new Date();
  periodEnd.setHours(24, 0, 0, 0);

  const periodStart = new Date(periodEnd);
  periodStart.setDate(periodStart.getDate() - 5);

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  };
}

const CURRENT_PERIOD = getCurrentDashboardPeriod();

function SuspiciousTrendPanel({ points }: { points: SuspiciousTrendPoint[] }) {
  const maxCount = Math.max(...points.map((point) => point.suspicious_count), 1);
  const amount = points.reduce((sum, point) => sum + point.suspicious_amount, 0);

  return <article className="panel suspicious-panel">
    <div className="panel-head"><div><h2>선택 기간 의심 거래 추이</h2><p className="panel-caption">의심 건수와 의심 금액을 함께 확인합니다</p></div><span className="trend-badge positive">선택 기간 기준</span></div>
    <div className="mini-chart-meta"><span>의심 금액</span><strong>{formatCompactMoney(amount)}</strong></div>
    <div className="mini-bars">{points.map((point) => <div className="mini-bar-column" key={point.date}><strong>{point.suspicious_count}</strong><div className="mini-bar-area"><span className="mini-bar" style={{ height: `${Math.max((point.suspicious_count / maxCount) * 100, 4)}%` }} /></div><span>{point.date}</span></div>)}</div>
  </article>;
}

export function DashboardPage() {
  const { data, isLoading, errorMessage } = useDashboardOverview(CURRENT_PERIOD);

  if (isLoading && !data) return <main className="dashboard-state">대시보드를 불러오는 중...</main>;
  if (errorMessage && !data) return <main className="dashboard-state">오류: {errorMessage}</main>;
  if (!data) return <main className="dashboard-state">표시할 데이터가 없습니다.</main>;

  return <AppLayout activeNav="dashboard">
    <div className="dashboard-content" id="main">
      <header className="app-page-header dashboard-header"><PageHeading eyebrow="LIVE OPERATIONS" title="FDS 통합 모니터링" /><div className="header-actions"><LiveStatus label="SSE 실시간 연결됨" /></div></header>
      {errorMessage && <p className="refresh-error">최근 갱신 실패: {errorMessage}</p>}

      <DashboardSummaryCards summary={data.summary} />
      <section className="dashboard-monitoring-grid">
        <HighRiskTrendPanel points={data.priority_trend} />
        <RiskGradeDistributionPanel items={data.risk_grade_distribution} summary={data.summary} />
        <div className="left-panels">
          <SuspiciousTrendPanel points={data.suspicious_trend} />
          <ChannelDistributionPanel items={data.channel_distribution} totalCount={data.summary.suspicious_transaction_count} />
        </div>
        <AgentInsightPanel insight={data.agent_insight} />
      </section>
    </div>
  </AppLayout>;
}
