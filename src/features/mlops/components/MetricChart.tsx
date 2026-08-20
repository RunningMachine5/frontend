// 외부 차트 라이브러리 없이 운영 지표의 현재값과 변화를 함께 보여준다.

import { useId, useMemo, useState, type PointerEvent } from "react";

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
  showDate?: boolean;
};

const WIDTH = 720;
const HEIGHT = 210;
const PADDING = { top: 16, right: 18, bottom: 34, left: 58 };
const Y_TICK_COUNT = 5;
const X_TICK_COUNT = 4;

function timestampValue(timestamp: string) {
  return new Date(timestamp).getTime();
}

function metricText(value: number, decimals: number, unit: string) {
  return `${value.toLocaleString("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${unit}`;
}

function axisText(value: number, decimals: number, unit: string) {
  if (Math.abs(value) >= 1_000) {
    return `${new Intl.NumberFormat("ko-KR", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value)}${unit}`;
  }
  const axisDecimals = Number.isInteger(value) ? 0 : Math.max(1, decimals);
  return metricText(value, axisDecimals, unit);
}

function niceMaximum(value: number, wholeNumbers: boolean) {
  if (value <= 0) return 1;
  const divisions = Y_TICK_COUNT - 1;
  const roughStep = value / divisions;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const stepFactor = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
    .find((step) => normalized <= step) ?? 10;
  const step = wholeNumbers
    ? Math.max(1, stepFactor * magnitude)
    : stepFactor * magnitude;
  return step * divisions;
}

function timeLabel(value: string, showDate: boolean, detailed = false) {
  return new Intl.DateTimeFormat("ko-KR", {
    ...(showDate || detailed ? { month: "numeric", day: "numeric" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function sampledTimestamps(timeline: string[]) {
  if (timeline.length <= X_TICK_COUNT) return timeline;
  return Array.from({ length: X_TICK_COUNT }, (_, index) => (
    timeline[Math.round(index * (timeline.length - 1) / (X_TICK_COUNT - 1))]
  )).filter((timestamp, index, rows) => rows.indexOf(timestamp) === index);
}

export function MetricChart({
  title,
  description,
  series,
  unit,
  decimals = 0,
  showDate = false,
}: MetricChartProps) {
  const gradientId = useId().replaceAll(":", "");
  const [activeTimestamp, setActiveTimestamp] = useState<string | null>(null);
  const allPoints = useMemo(() => series.flatMap((item) => item.points), [series]);
  const timeline = useMemo(() => (
    [...new Set(allPoints.map((point) => point.timestamp))]
      .sort((left, right) => timestampValue(left) - timestampValue(right))
  ), [allPoints]);

  const rawMaximum = Math.max(0, ...allPoints.map((point) => point.value));
  const wholeNumberAxis = decimals === 0 || unit === "건" || unit === "개";
  const maximum = unit === "%"
    ? 100
    : niceMaximum(rawMaximum, wholeNumberAxis);
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const fallbackTime = new Date().toISOString();
  const startTime = timestampValue(timeline[0] ?? fallbackTime);
  const endTime = timestampValue(timeline.at(-1) ?? fallbackTime);

  const xPosition = (timestamp: string) => {
    if (startTime === endTime) return PADDING.left + plotWidth / 2;
    return PADDING.left
      + (timestampValue(timestamp) - startTime) / (endTime - startTime) * plotWidth;
  };
  const yPosition = (value: number) => (
    PADDING.top + plotHeight - value / maximum * plotHeight
  );
  const pathFor = (points: MonitoringPoint[]) => (
    [...points]
      .sort((left, right) => timestampValue(left.timestamp) - timestampValue(right.timestamp))
      .map((point, index) => (
        `${index === 0 ? "M" : "L"} ${xPosition(point.timestamp).toFixed(1)} ${yPosition(point.value).toFixed(1)}`
      ))
      .join(" ")
  );

  const seriesStats = series.map((item) => ({
    ...item,
    current: item.points.at(-1)?.value ?? 0,
    peak: Math.max(0, ...item.points.map((point) => point.value)),
  }));
  const xTicks = sampledTimestamps(timeline);
  const activeX = activeTimestamp ? xPosition(activeTimestamp) : null;

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (timeline.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const pointerX = (event.clientX - rect.left) / rect.width * WIDTH;
    const ratio = Math.max(0, Math.min(1, (pointerX - PADDING.left) / plotWidth));
    const targetTime = startTime + (endTime - startTime) * ratio;
    const nearest = timeline.reduce((best, timestamp) => (
      Math.abs(timestampValue(timestamp) - targetTime)
        < Math.abs(timestampValue(best) - targetTime)
        ? timestamp
        : best
    ), timeline[0]);
    setActiveTimestamp(nearest);
  };

  const ariaSummary = seriesStats
    .map((item) => `${item.label} 현재 ${metricText(item.current, decimals, unit)}, 최고 ${metricText(item.peak, decimals, unit)}`)
    .join(", ");

  return (
    <article className="monitoring-chart-panel">
      <header>
        <div><h2>{title}</h2><p>{description}</p></div>
        {allPoints.length > 0 && (
          <div aria-label="현재값과 구간 최고값" className="chart-legend">
            {seriesStats.map((item) => (
              <span key={item.label}>
                <i style={{ background: item.color }} />
                <b>{item.label}</b>
                <strong>{metricText(item.current, decimals, unit)}</strong>
                <em>최고 {metricText(item.peak, decimals, unit)}</em>
              </span>
            ))}
          </div>
        )}
      </header>
      {allPoints.length === 0 ? (
        <div className="chart-empty">선택 구간에 수집된 지표가 없습니다.</div>
      ) : (
        <div className="metric-chart-body">
            <svg
              aria-label={`${title} 시계열. ${ariaSummary}`}
              className="metric-chart"
              onPointerLeave={() => setActiveTimestamp(null)}
              onPointerMove={handlePointerMove}
              role="img"
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            >
              <defs>
                <linearGradient id={`metric-area-${gradientId}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={series[0]?.color} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={series[0]?.color} stopOpacity="0" />
                </linearGradient>
              </defs>

              {Array.from({ length: Y_TICK_COUNT }, (_, index) => {
                const ratio = index / (Y_TICK_COUNT - 1);
                const value = maximum * (1 - ratio);
                const y = PADDING.top + plotHeight * ratio;
                return (
                  <g key={ratio}>
                    <line
                      className="metric-chart-grid-line"
                      x1={PADDING.left}
                      x2={WIDTH - PADDING.right}
                      y1={y}
                      y2={y}
                    />
                    <text className="metric-chart-axis-label" textAnchor="end" x={PADDING.left - 10} y={y + 4}>
                      {axisText(value, decimals, unit)}
                    </text>
                  </g>
                );
              })}

              {xTicks.map((timestamp, index) => (
                <text
                  className="metric-chart-axis-label"
                  key={timestamp}
                  textAnchor={index === 0 ? "start" : index === xTicks.length - 1 ? "end" : "middle"}
                  x={xPosition(timestamp)}
                  y={HEIGHT - 8}
                >
                  {timeLabel(timestamp, showDate)}
                </text>
              ))}

              {series.length === 1 && series[0].points.length > 1 && (
                <path
                  className="metric-chart-area"
                  d={`${pathFor(series[0].points)} L ${xPosition(series[0].points.at(-1)!.timestamp)} ${HEIGHT - PADDING.bottom} L ${xPosition(series[0].points[0].timestamp)} ${HEIGHT - PADDING.bottom} Z`}
                  fill={`url(#metric-area-${gradientId})`}
                />
              )}

              {series.map((item) => {
                const latest = item.points.at(-1);
                return (
                  <g key={item.label}>
                    <path
                      className="metric-chart-series-line"
                      d={pathFor(item.points)}
                      fill="none"
                      stroke={item.color}
                    />
                    {latest && (
                      <>
                        <circle
                          className="metric-chart-latest-ring"
                          cx={xPosition(latest.timestamp)}
                          cy={yPosition(latest.value)}
                          fill={item.color}
                          r="9"
                        />
                        <circle
                          className="metric-chart-latest-point"
                          cx={xPosition(latest.timestamp)}
                          cy={yPosition(latest.value)}
                          fill={item.color}
                          r="4"
                        />
                      </>
                    )}
                    {activeTimestamp && item.points
                      .filter((point) => point.timestamp === activeTimestamp)
                      .map((point) => (
                        <circle
                          className="metric-chart-active-point"
                          cx={xPosition(point.timestamp)}
                          cy={yPosition(point.value)}
                          fill="var(--ops-surface)"
                          key={point.timestamp}
                          r="5"
                          stroke={item.color}
                        />
                      ))}
                  </g>
                );
              })}

              {activeX !== null && (
                <line
                  className="metric-chart-crosshair"
                  x1={activeX}
                  x2={activeX}
                  y1={PADDING.top}
                  y2={HEIGHT - PADDING.bottom}
                />
              )}
            </svg>

            {activeTimestamp && activeX !== null && (
              <div
                className="metric-chart-tooltip"
                style={{
                  left: `${activeX / WIDTH * 100}%`,
                  transform: activeX > WIDTH * 0.72 ? "translateX(-100%)" : "translateX(10px)",
                }}
              >
                <time>{timeLabel(activeTimestamp, showDate, true)}</time>
                {series.map((item) => {
                  const point = item.points.find((row) => row.timestamp === activeTimestamp);
                  return (
                    <span key={item.label}>
                      <i style={{ background: item.color }} />
                      {item.label}
                      <strong>{point ? metricText(point.value, decimals, unit) : "—"}</strong>
                    </span>
                  );
                })}
              </div>
            )}
        </div>
      )}
    </article>
  );
}
