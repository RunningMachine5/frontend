import type { DistributionItem } from "../dashboardOverviewTypes";
import { formatMoney, formatNumber } from "../dashboardFormatters";

function ChannelBubbles({ items }: { items: DistributionItem[] }) {
  const topItems = [...items].sort((a, b) => b.count - a.count).slice(0, 4);
  const maxCount = Math.max(...topItems.map((item) => item.count), 1);
  const positions = [{ left: "22%", top: "48%" }, { left: "52%", top: "32%" }, { left: "79%", top: "52%" }, { left: "61%", top: "74%" }];

  return <div className="bubble-stage">
    {topItems.map((item, index) => {
      const size = 42 + Math.sqrt(item.count / maxCount) * 72;
      const labelSize = Math.max(9, Math.min(14, size * 0.13));
      const countSize = Math.max(8, Math.min(11, size * 0.1));
      return <div className={`bubble bubble-${index}`} key={item.label} style={{ ...positions[index], height: size, width: size }} title={`${item.label}: ${formatNumber(item.count)}건 / ${formatMoney(item.amount)}`}><strong style={{ fontSize: labelSize }}>{item.label}</strong><span style={{ fontSize: countSize }}>{formatNumber(item.count)}건</span></div>;
    })}
    <div className="bubble-legend">{topItems.map((item, index) => <span key={item.label}><i className={`bubble-dot bubble-${index}`} />{item.label}</span>)}</div>
  </div>;
}

export function ChannelDistributionPanel({ items, totalCount }: { items: DistributionItem[]; totalCount: number }) {
  return <article className="panel channel-panel">
    <div className="panel-head"><div><h2>채널별 의심거래 노출도</h2><p className="panel-caption">원 크기: 의심 거래 건수 · 선택 기간 기준</p></div><strong>총 {formatNumber(totalCount)}건</strong></div>
    <ChannelBubbles items={items} />
  </article>;
}
