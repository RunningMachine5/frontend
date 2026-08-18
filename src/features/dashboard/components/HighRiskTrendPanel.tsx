import type { PriorityTrendPoint } from "../dashboardOverviewTypes";
import { formatNumber } from "../dashboardFormatters";

function TrendChart({ points }: { points: PriorityTrendPoint[] }) {
  const width = 760;
  const height = 170;
  const padding = { top: 18, right: 18, bottom: 30, left: 34 };
  const maxValue = Math.max(...points.map((point) => point.total_count), 1);
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const coordinates = points.map((point, index) => ({
    x: padding.left + (points.length > 1 ? (chartWidth * index) / (points.length - 1) : chartWidth / 2),
    y: padding.top + chartHeight - (point.total_count / maxValue) * chartHeight,
    point,
  }));
  const line = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");
  const lastPoint = coordinates[coordinates.length - 1];
  const area = coordinates.length ? `${padding.left},${padding.top + chartHeight} ${line} ${lastPoint.x},${padding.top + chartHeight}` : "";

  return <div className="trend-chart-wrap"><svg aria-label="날짜별 고위험 이상거래 발생 추이" className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img">
    <defs><linearGradient id="priority-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#b640be" stopOpacity="0.42" /><stop offset="100%" stopColor="#b640be" stopOpacity="0" /></linearGradient></defs>
    {[0, 0.33, 0.66, 1].map((ratio) => {
      const y = padding.top + chartHeight * ratio;
      return <g key={ratio}><line stroke="#2e2e38" strokeWidth="1" x1={padding.left} x2={width - padding.right} y1={y} y2={y} /><text className="chart-axis" textAnchor="end" x={padding.left - 10} y={y + 4}>{Math.round(maxValue * (1 - ratio))}</text></g>;
    })}
    {area && <polygon fill="url(#priority-area)" points={area} />}
    {line && <polyline fill="none" points={line} stroke="#b640be" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />}
    {coordinates.map(({ x, y, point }) => <g key={point.date}><circle cx={x} cy={y} fill="#121217" r="5" stroke="#b640be" strokeWidth="3" /><text className="chart-value" textAnchor="middle" x={x} y={y - 12}>{point.total_count}</text><text className="chart-axis" textAnchor="middle" x={x} y={height - 7}>{point.date}</text></g>)}
  </svg></div>;
}

export function HighRiskTrendPanel({ points }: { points: PriorityTrendPoint[] }) {
  const peak = Math.max(...points.map((point) => point.total_count), 0);
  return <article className="panel priority-panel">
    <div className="panel-head"><div><h2>고위험 이상거래 발생 추이</h2><p className="panel-caption">HIGH 이상 거래의 일별 집중도를 확인합니다</p></div><span className="trend-badge"><i />최고 {formatNumber(peak)}건</span></div>
    <div className="chart-legend"><span><i />VERY_HIGH + HIGH</span><em>거래 건수 (건)</em></div>
    <TrendChart points={points} />
  </article>;
}
