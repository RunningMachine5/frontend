import type { DistributionItem } from "../dashboardOverviewTypes";
import { formatMoney, formatNumber } from "../dashboardFormatters";

function ChannelBubbles({ items }: { items: DistributionItem[] }) {
  const topItems = [...items].sort((a, b) => b.count - a.count).slice(0, 4);
  const maxCount = Math.max(...topItems.map((item) => item.count), 1);
  const positions = [{ left: "18%", top: "48%" }, { left: "48%", top: "34%" }, { left: "72%", top: "53%" }, { left: "58%", top: "73%" }];

  return <div className="bubble-stage">
    {topItems.map((item, index) => {
      const size = 42 + Math.sqrt(item.count / maxCount) * 72;
      return <div className={`bubble bubble-${index}`} key={item.label} style={{ ...positions[index], height: size, width: size }} title={`${item.label}: ${formatNumber(item.count)}건 / ${formatMoney(item.amount)}`}><strong>{item.label}</strong><span>{formatNumber(item.count)}건</span></div>;
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
