import type { DashboardOverviewSummary } from "../dashboardOverviewTypes";
import { formatCompactMoney, formatNumber } from "../dashboardFormatters";

export function DashboardSummaryCards({ summary }: { summary: DashboardOverviewSummary }) {
  const metrics = [
    { tone: "red", label: "우선 검토", value: `${formatNumber(summary.priority_review_count)}건`, note: "HIGH 이상 즉시 확인" },
    { tone: "orange", label: "의심 거래", value: `${formatNumber(summary.suspicious_transaction_count)}건`, note: "ML·룰 분석 대상" },
    { tone: "pink", label: "의심 거래 금액", value: formatCompactMoney(summary.suspicious_amount), note: "잠재 피해 노출액" },
    { tone: "purple", label: "분석 거래", value: `${formatNumber(summary.total_transaction_count)}건`, note: "선택 기간 전체 거래" },
    { tone: "green", label: "Rule 분석 완료", value: `${formatNumber(summary.rule_analysis_completed_count)}건`, note: "분석 완료 거래" },
  ];

  return <section className="metric-grid">
    {metrics.map((metric) => <article className={`metric-card ${metric.tone}`} key={metric.label}>
      <div className="metric-card-head"><span>{metric.label}</span><small><i />{metric.note}</small></div>
      <strong>{metric.value}</strong>
    </article>)}
  </section>;
}
