import type { DashboardOverviewSummary } from "../dashboardOverviewTypes";
import { formatCompactMoney, formatNumber } from "../dashboardFormatters";

export function DashboardSummaryCards({ summary }: { summary: DashboardOverviewSummary }) {
  const metrics = [
    {
      tone: "red",
      label: "우선 검토",
      value: `${formatNumber(summary.priority_review_count)}건`,
      note: "HIGH 이상 즉시 확인",
      href: "#queue?risk_grades=VERY_HIGH,HIGH",
    },
    { tone: "purple", label: "전체 거래", value: `${formatNumber(summary.total_transaction_count)}건`, note: "선택 기간 전체 거래" },
    {
      tone: "green",
      label: "처리 완료 사건 / 사기 의심 전체 거래",
      value: `${formatNumber(summary.completed_case_count)} / ${formatNumber(summary.suspicious_transaction_count)}건`,
      note: "처리 완료 / 현재 의심 거래",
      href: "#queue",
    },
    { tone: "pink", label: "의심 거래 금액", value: formatCompactMoney(summary.suspicious_amount), note: "잠재 피해 노출액" },
  ];

  return <section className="metric-grid">
    {metrics.map((metric) => {
      const card = <article className={`metric-card ${metric.tone}`}>
        <div className="metric-card-head"><span>{metric.label}</span><small><i />{metric.note}</small></div>
        <strong>{metric.value}</strong>
      </article>;

      return metric.href
        ? <a aria-label={`${metric.label} 목록 보기`} className="metric-card-link" href={metric.href} key={metric.label}>{card}</a>
        : <div className="metric-card-link" key={metric.label}>{card}</div>;
    })}
  </section>;
}
