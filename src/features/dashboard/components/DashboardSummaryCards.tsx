import type { DashboardOverviewSummary } from "../dashboardOverviewTypes";
import { formatCompactMoney, formatNumber } from "../dashboardFormatters";

const metricColors = ["purple", "orange", "red", "pink", "green"] as const;

export function DashboardSummaryCards({ summary }: { summary: DashboardOverviewSummary }) {
  const metrics = [
    { label: "분석 거래", value: `${formatNumber(summary.total_transaction_count)}건`, note: "선택 기간 전체 거래" },
    { label: "의심 거래", value: `${formatNumber(summary.suspicious_transaction_count)}건`, note: "ML·룰 분석 대상" },
    { label: "우선 검토", value: `${formatNumber(summary.priority_review_count)}건`, note: "VERY_HIGH + HIGH" },
    { label: "의심 거래 금액", value: formatCompactMoney(summary.suspicious_amount), note: "사기 의심 총 금액" },
    { label: "Rule 분석 완료", value: `${formatNumber(summary.rule_analysis_completed_count)}건`, note: "분석 완료 거래" },
  ];

  return <section className="metric-grid">
    {metrics.map((metric, index) => <article className={`metric-card ${metricColors[index]}`} key={metric.label}>
      <div className="metric-card-head"><span>{metric.label}</span><small><i />{metric.note}</small></div>
      <strong>{metric.value}</strong>
    </article>)}
  </section>;
}
