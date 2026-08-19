// 외부 차트 라이브러리 없이 운영 시계열을 읽기 쉬운 선으로 표시한다.

import type { MonitoringPoint } from "../mlopsTypes";

type ChartSeries = {
  label: string;
  color: string;
  points: MonitoringPoint[];
};

type MetricChartProps = {
  title: string;
  description: string;
  series: ChartSeries[];
  unit: string;
  decimals?: number;
};

const WIDTH = 640;
const HEIGHT = 190;
const PADDING_X = 30;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 30;

function linePoints(points: MonitoringPoint[], maxValue: number) {
  const width = WIDTH - PADDING_X * 2;
  const height = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  return points.map((point, index) => {
    const x = PADDING_X + (points.length === 1 ? width : index / (points.length - 1) * width);
    const y = PADDING_TOP + height - point.value / maxValue * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function timeLabel(value: string | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function MetricChart({
  title,
  description,
  series,
  unit,
  decimals = 0,
}: MetricChartProps) {
  const allPoints = series.flatMap((item) => item.points);
  const maxValue = Math.max(1, ...allPoints.map((point) => point.value));
  const firstTime = allPoints.at(0)?.timestamp;
  const lastTime = allPoints.at(-1)?.timestamp;

  return (
    <article className="monitoring-chart-panel">
      <header>
        <div><h2>{title}</h2><p>{description}</p></div>
        <div className="chart-legend">
          {series.map((item) => (
            <span key={item.label}><i style={{ background: item.color }} />{item.label}</span>
          ))}
        </div>
      </header>
      {allPoints.length === 0 ? (
        <div className="chart-empty">선택 구간에 수집된 지표가 없습니다.</div>
      ) : (
        <svg
          aria-label={`${title} 시계열, 최댓값 ${maxValue.toFixed(decimals)}${unit}`}
          className="metric-chart"
          role="img"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        >
          <line x1={PADDING_X} x2={WIDTH - PADDING_X} y1={PADDING_TOP} y2={PADDING_TOP} />
          <line x1={PADDING_X} x2={WIDTH - PADDING_X} y1={HEIGHT - PADDING_BOTTOM} y2={HEIGHT - PADDING_BOTTOM} />
          <text x={PADDING_X} y={12}>{maxValue.toFixed(decimals)}{unit}</text>
          <text x={PADDING_X} y={HEIGHT - 7}>{timeLabel(firstTime)}</text>
          <text textAnchor="end" x={WIDTH - PADDING_X} y={HEIGHT - 7}>{timeLabel(lastTime)}</text>
          {series.map((item) => (
            <polyline
              fill="none"
              key={item.label}
              points={linePoints(item.points, maxValue)}
              stroke={item.color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
            />
          ))}
        </svg>
      )}
    </article>
  );
}
