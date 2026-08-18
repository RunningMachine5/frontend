import type { DashboardAgentInsight } from "../dashboardOverviewTypes";
import { formatDate, formatNumber } from "../dashboardFormatters";

const agentColors = ["#ee4047", "#f49121", "#b640be", "#7a49dc", "#3ec887"];
type AgentChartItem = { label: string; value: number };

function toAgentItems(insight: DashboardAgentInsight | null): AgentChartItem[] {
  const spec = insight?.chart_spec;
  if (!spec || !Array.isArray(spec.items)) return [];
  return spec.items.map((item): AgentChartItem | null => {
    if (!item || typeof item !== "object") return null;
    const source = item as Record<string, unknown>;
    const value = source.current_count ?? source.increase_count;
    return typeof source.label === "string" && typeof value === "number" ? { label: source.label, value } : null;
  }).filter((item): item is AgentChartItem => item !== null).sort((a, b) => b.value - a.value).slice(0, 5);
}

export function AgentInsightPanel({ insight }: { insight: DashboardAgentInsight | null }) {
  const items = toAgentItems(insight);
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return <section className="panel agent-panel">
    <div className="agent-panel-head"><div><p className="eyebrow">DASHBOARD INSIGHT AGENT</p><h2>{insight?.title ?? "AI Agent 분석 · 룰/이상징후 조합 TOP 5"}</h2><p className="panel-caption">분석 기간 기준 · 원인 확정이 아닌 증가 후보</p></div>{insight && <span className="status-badge"><i />최신 분석 완료</span>}</div>
    {items.length > 0 ? <div className="agent-bars">{items.map((item, index) => <div className="agent-row" key={item.label}><span>{item.label}</span><div className="bar-track"><i className="bar-fill" style={{ backgroundColor: agentColors[index % agentColors.length], width: `${(item.value / maxValue) * 100}%` }} /></div><strong>{formatNumber(item.value)}</strong></div>)}</div> : <div className="agent-empty">생성된 조합 데이터가 아직 없습니다.</div>}
    <div className="agent-summary"><strong>AI Agent 자연어 요약</strong><p>{insight?.summary ?? "아직 생성된 AI Agent Insight가 없습니다."}</p><span>{insight ? `생성 시각 · ${formatDate(insight.created_at)}` : "Insight 생성 후 요약이 표시됩니다."}</span></div>
  </section>;
}
