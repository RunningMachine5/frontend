import type { DashboardOverviewSummary, DistributionItem } from "../dashboardOverviewTypes";
import { formatCompactMoney, formatNumber } from "../dashboardFormatters";

const riskColors = ["#ee4047", "#f49121", "#7a49dc", "#3ec887"];

export function RiskGradeDistributionPanel({ items, summary }: { items: DistributionItem[]; summary: DashboardOverviewSummary }) {
  const maxCount = Math.max(...items.map((item) => item.count), 1);
  return <article className="panel risk-panel">
    <h2>위험등급별 의심거래</h2><p className="panel-caption">표시: 거래 건수 / 의심 금액</p>
    <div className="risk-list">{items.map((item, index) => <div className="risk-row" key={item.label}><span className="risk-label">{item.label}</span><div className="bar-track"><span className="bar-fill" style={{ backgroundColor: riskColors[index % riskColors.length], width: `${(item.count / maxCount) * 100}%` }} /></div><span className="risk-detail">{formatNumber(item.count)}건 / {formatCompactMoney(item.amount)}</span></div>)}</div>
    <footer>우선 검토 {formatNumber(summary.priority_review_count)}건 · 검토 필요 거래 기준</footer>
  </article>;
}
