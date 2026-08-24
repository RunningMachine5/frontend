import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CaseListItem } from "../../queue/queueTypes";
import { formatCompactMoney, formatNumber } from "../dashboardFormatters";

const SELECTED_TRANSACTION_ID_KEY = "fds.selectedTransactionId";
const RECENT_POINT_LIMIT = 30;
const MAX_TIME_LABELS = 7;
const MIN_TIME_LABEL_GAP_PX = 110;
const riskScoreFormat = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 1,
});

export type RealtimeRiskPoint = {
  transactionId: number;
  timeLabel: string;
  dateTimeLabel: string;
  amount: number;
  score: number;
  isLatest?: boolean;
};

type RealtimeChartRow = {
  transaction_id: number;
  transaction_amount: number;
  transaction_datetime: string;
  received_at?: string;
  risk_score: number | null;
};

export type TimeInterval = "second" | "minute";

function getEventTime(row: RealtimeChartRow) {
  // received_at은 서버 환경에 따라 9시간 차이가 날 수 있어 실제 거래 시각을 우선한다.
  return row.transaction_datetime;
}

function formatTime(value: string | number, interval: TimeInterval) {
  return new Date(value).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: interval === "second" ? "2-digit" : undefined,
    hour12: false,
  });
}

function formatDate(value: string | number, includeYear = false) {
  const date = new Date(value);
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return includeYear ? `${year}.${month}.${day}` : `${month}.${day}`;
}

function formatRiskScore(score: number) {
  return riskScoreFormat.format(score);
}

function getTimeLabelIndexes(pointCount: number, renderedPlotWidth: number) {
  if (pointCount <= 0) return new Set<number>();
  if (pointCount === 1) return new Set([0]);

  const pointGap = renderedPlotWidth / (pointCount - 1);
  const requiredPointGap = Math.max(
    1,
    Math.ceil(MIN_TIME_LABEL_GAP_PX / pointGap),
  );
  const availableLabelCount = Math.floor(
    (pointCount - 1) / requiredPointGap,
  ) + 1;
  const labelCount = Math.min(
    pointCount,
    MAX_TIME_LABELS,
    Math.max(2, availableLabelCount),
  );

  return new Set(
    Array.from({ length: labelCount }, (_, index) => (
      Math.round((index * (pointCount - 1)) / (labelCount - 1))
    )),
  );
}

export function buildRealtimeRiskPoints(
  rows: RealtimeChartRow[],
  interval: TimeInterval,
): RealtimeRiskPoint[] {
  const timeRows = [...rows]
    .sort(
      (left, right) =>
        new Date(getEventTime(left)).getTime() - new Date(getEventTime(right)).getTime(),
    )
    // 한 화면에는 최신 30건만 표시해 실제 시간 순서와 점을 읽기 쉽게 유지한다.
    .slice(-RECENT_POINT_LIMIT);

  return timeRows.map((row, index) => {
    const isLatest = index === timeRows.length - 1;
    const eventTime = getEventTime(row);
    const time = formatTime(eventTime, interval);

    return {
      transactionId: row.transaction_id,
      timeLabel: isLatest ? `${time} 최신` : time,
      dateTimeLabel: `${formatDate(eventTime, true)} ${formatTime(eventTime, "second")}`,
      amount: row.transaction_amount,
      score: row.risk_score ?? 0,
      isLatest,
    };
  });
}

function selectTransactionAndNavigate(transactionId: number) {
  sessionStorage.setItem(SELECTED_TRANSACTION_ID_KEY, String(transactionId));
  window.location.hash = "#case";
}

// 부드러운 베지어 곡선 패스 생성
function createSmoothPath(coords: { x: number; y: number }[]): string {
  if (coords.length === 0) return "";
  if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;

  let path = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const current = coords[i];
    const next = coords[i + 1];
    const controlX = (current.x + next.x) / 2;
    path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
  }
  return path;
}

export function getRiskGradeStyle(score: number) {
  if (score >= 80) {
    return {
      mainColor: "#e45b64",
      badgeBg: "#e45b64",
      badgeBorder: "#ef858d",
      textColor: "#ffffff",
      gradeText: "심각",
    };
  }
  if (score >= 60) {
    return {
      mainColor: "#db934b",
      badgeBg: "#db934b",
      badgeBorder: "#e2a469",
      textColor: "#ffffff",
      gradeText: "경고",
    };
  }
  if (score >= 40) {
    return {
      mainColor: "#c2a24f",
      badgeBg: "#363127",
      badgeBorder: "#c2a24f",
      textColor: "#f2f0f3",
      gradeText: "주의",
    };
  }
  return {
    mainColor: "#5d9f7e",
    badgeBg: "#25362f",
    badgeBorder: "#5d9f7e",
    textColor: "#ffffff",
    gradeText: "정상",
  };
}

export function RealtimeRiskTrendChart({
  items,
  height = 230,
}: {
  items: RealtimeRiskPoint[];
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [containerHeight, setContainerHeight] = useState(height);
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number } | null>(null);

  // 카드 안에서 실제로 확보된 크기만큼 차트를 그려 불필요한 위아래 여백을 남기지 않는다.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleResize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) {
        setContainerWidth(Math.round(rect.width));
      }
      if (rect.height > 0) {
        setContainerHeight(Math.round(rect.height));
      }
    };

    handleResize();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height: observedHeight } = entry.contentRect;
        if (width > 0) {
          setContainerWidth(Math.round(width));
        }
        if (observedHeight > 0) {
          setContainerHeight(Math.round(observedHeight));
        }
      }
    });

    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, []);

  const width = Math.max(360, containerWidth);
  const renderHeight = Math.max(140, containerHeight);
  const padding = { top: 18, right: 48, bottom: 22, left: 88 };
  const innerInsetX = 18; // 좌우 끝 점과 뱃지가 Y축 눈금 텍스트와 겹치지 않으면서 가로폭 최대 확장

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = renderHeight - padding.top - padding.bottom;
  const plotWidth = Math.max(10, chartWidth - innerInsetX * 2);
  const plotStartX = padding.left + innerInsetX;
  const renderedPlotWidth = plotWidth * (containerWidth / width);

  const maxAmount = Math.max(...items.map((item) => item.amount), 10_000_000);
  const minScore = 0;
  const maxScore = 100;

  const count = items.length;
  const stepX = count > 1 ? plotWidth / (count - 1) : plotWidth / 2;

  const amountCoords = items.map((item, index) => {
    const x = count > 1 ? plotStartX + stepX * index : plotStartX + plotWidth / 2;
    const amountRatio = item.amount / maxAmount;
    const y = padding.top + chartHeight - amountRatio * chartHeight;
    return { x, y, item };
  });

  const scoreCoords = items.map((item, index) => {
    const x = count > 1 ? plotStartX + stepX * index : plotStartX + plotWidth / 2;
    const scoreRatio = (item.score - minScore) / (maxScore - minScore);
    const y = padding.top + chartHeight - scoreRatio * chartHeight;
    return { x, y, item };
  });

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // 금액 스무스 에어리어
  const amountSmoothLine = createSmoothPath(amountCoords.map((c) => ({ x: c.x, y: c.y })));
  const firstAmount = amountCoords[0];
  const lastAmount = amountCoords[amountCoords.length - 1];
  const amountAreaPath = amountCoords.length > 1
    ? `${amountSmoothLine} L ${lastAmount.x} ${padding.top + chartHeight} L ${firstAmount.x} ${padding.top + chartHeight} Z`
    : "";

  // 위험 점수 스무스 라인
  const scoreSmoothLine = createSmoothPath(scoreCoords.map((c) => ({ x: c.x, y: c.y })));

  const activeItem = hoveredIndex !== null ? items[hoveredIndex] : null;
  const activeScoreCoord = hoveredIndex !== null ? scoreCoords[hoveredIndex] : null;
  const activeGradeStyle = activeItem ? getRiskGradeStyle(activeItem.score) : null;
  const timeLabelIndexes = getTimeLabelIndexes(scoreCoords.length, renderedPlotWidth);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const tooltip = tooltipRef.current;
    if (!activeScoreCoord || !container || !tooltip) return;

    const boundaryGap = 8;
    const pointGap = 14;
    const containerRect = container.getBoundingClientRect();
    const cardRect = container.closest(".panel")?.getBoundingClientRect() ?? containerRect;
    const pointX = (activeScoreCoord.x / width) * container.clientWidth;
    const pointY = (activeScoreCoord.y / renderHeight) * container.clientHeight;
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    const minLeft = cardRect.left - containerRect.left + boundaryGap;
    const maxRight = cardRect.right - containerRect.left - boundaryGap;
    const minTop = cardRect.top - containerRect.top + boundaryGap;
    const maxBottom = cardRect.bottom - containerRect.top - boundaryGap;
    const canPlaceRight = pointX + pointGap + tooltipWidth <= maxRight;
    const canPlaceLeft = pointX - pointGap - tooltipWidth >= minLeft;

    let left: number;
    let top: number;

    if (canPlaceRight || canPlaceLeft) {
      const placeRight = canPlaceRight && (!canPlaceLeft || pointX <= container.clientWidth / 2);
      left = placeRight ? pointX + pointGap : pointX - pointGap - tooltipWidth;
      top = pointY - tooltipHeight / 2;
    } else {
      // 좁은 화면에서는 카드 헤더 여유까지 포함해 점을 가리지 않는 방향을 사용한다.
      left = pointX - tooltipWidth / 2;
      const canPlaceBelow = pointY + pointGap + tooltipHeight <= maxBottom;
      const canPlaceAbove = pointY - pointGap - tooltipHeight >= minTop;
      top = canPlaceBelow && (!canPlaceAbove || pointY <= (minTop + maxBottom) / 2)
        ? pointY + pointGap
        : pointY - pointGap - tooltipHeight;
    }

    const maxLeft = Math.max(minLeft, maxRight - tooltipWidth);
    const maxTop = Math.max(minTop, maxBottom - tooltipHeight);
    setTooltipPosition({
      left: Math.min(Math.max(left, minLeft), maxLeft),
      top: Math.min(Math.max(top, minTop), maxTop),
    });
  }, [activeScoreCoord?.x, activeScoreCoord?.y, containerHeight, containerWidth, renderHeight, width]);

  return (
    <div className="trend-chart-wrap realtime-risk-chart-wrap" ref={containerRef}>
      <svg
        aria-label="실시간 위험 거래 금액 및 위험 점수 모니터링 차트"
        className="trend-chart"
        viewBox={`0 0 ${width} ${renderHeight}`}
        role="img"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <defs>
          {/* 금액 영역 그라디언트 */}
          <linearGradient id="realtime-amount-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#6f8fe6" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#6f8fe6" stopOpacity="0.02" />
          </linearGradient>

          {/* 위험 점수 영역 은은한 글로우 */}
          <linearGradient id="realtime-score-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#e45b64" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#e45b64" stopOpacity="0" />
          </linearGradient>

          {/* 위험 점수 곡선 다이나믹 멀티 컬러 그라디언트 (등급에 따라 선 색상 변화) */}
          {scoreCoords.length > 1 && (
            <linearGradient
              id="realtime-score-line-grad"
              gradientUnits="userSpaceOnUse"
              x1={scoreCoords[0].x}
              x2={scoreCoords[scoreCoords.length - 1].x}
              y1="0"
              y2="0"
            >
              {scoreCoords.map(({ x, item }, idx) => {
                const startX = scoreCoords[0].x;
                const totalDist = Math.max(1, scoreCoords[scoreCoords.length - 1].x - startX);
                const offsetPct = Math.max(0, Math.min(100, ((x - startX) / totalDist) * 100));
                const gradeColor = getRiskGradeStyle(item.score).mainColor;
                return (
                  <stop
                    key={`score-grad-${idx}`}
                    offset={`${offsetPct.toFixed(1)}%`}
                    stopColor={gradeColor}
                  />
                );
              })}
            </linearGradient>
          )}
        </defs>

        {/* 그리드 가이드라인 및 Y축 */}
        {[0, 0.33, 0.66, 1].map((ratio) => {
          const y = padding.top + chartHeight * ratio;
          const leftAmountVal = maxAmount * (1 - ratio);
          const rightScoreVal = Math.round(maxScore * (1 - ratio));

          return (
            <g key={ratio}>
              <line
                stroke="#3a373e"
                strokeDasharray={ratio > 0 && ratio < 1 ? "4 4" : undefined}
                strokeWidth="1"
                x1={padding.left - 6}
                x2={width - padding.right + 6}
                y1={y}
                y2={y}
              />
              <text
                className="chart-axis amount-axis"
                dominantBaseline="middle"
                textAnchor="middle"
                x={padding.left / 2}
                y={y}
              >
                {formatCompactMoney(leftAmountVal)}
              </text>
              <text
                className="chart-axis score-axis"
                dominantBaseline="middle"
                textAnchor="middle"
                x={width - padding.right / 2}
                y={y}
              >
                {rightScoreVal}점
              </text>
            </g>
          );
        })}

        {/* 호버 시 수직 가이드라인 */}
        {activeScoreCoord && (
          <line
            stroke="#6f8fe6"
            strokeDasharray="3 3"
            strokeOpacity="0.6"
            strokeWidth="1.5"
            x1={activeScoreCoord.x}
            x2={activeScoreCoord.x}
            y1={padding.top}
            y2={padding.top + chartHeight}
          />
        )}

        {/* 1. 위험 금액 스무스 에어리어 & 메인 커브 */}
        {amountAreaPath && (
          <path d={amountAreaPath} fill="url(#realtime-amount-area)" />
        )}
        {amountSmoothLine && (
          <path
            d={amountSmoothLine}
            fill="none"
            stroke="#6f8fe6"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
        )}

        {/* 2. 위험 금액 포인트 (클릭 가능) */}
        {amountCoords.map(({ x, y, item }, index) => {
          const isHovered = hoveredIndex === index;
          const isHighOrLatest = item.isLatest || item.score >= 80;

          return (
            <g
              className={`chart-interactive-point ${isHovered ? "point-hovered" : ""}`}
              key={`amount-${item.transactionId}-${item.timeLabel}`}
              onClick={() => selectTransactionAndNavigate(item.transactionId)}
              onMouseEnter={() => setHoveredIndex(index)}
              style={{ cursor: "pointer" }}
            >
              <title>{`TX-${item.transactionId} · 금액 ${formatNumber(item.amount)}원 (클릭 시 상세 분석 이동)`}</title>
              <circle
                cx={x}
                cy={y}
                fill="#1d1c20"
                r={isHovered ? "6.5" : isHighOrLatest ? "5.5" : "4.5"}
                stroke="#6f8fe6"
                strokeWidth={isHovered ? "3" : "2"}
              />
              {/* 점 위의 금액 라벨 제거 (마우스 호버 툴팁 카드로 깔끔하게 표시) */}
            </g>
          );
        })}

        {/* 3. 위험 점수 스무스 라인 (등급에 따라 변화하는 다이나믹 그라디언트 스트로크) */}
        {scoreSmoothLine && (
          <path
            d={scoreSmoothLine}
            fill="none"
            stroke={scoreCoords.length > 1 ? "url(#realtime-score-line-grad)" : "#e45b64"}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3.5"
          />
        )}

        {/* 4. 위험 점수 포인트 & 뱃지 (위험 등급별 색상 적용) */}
        {scoreCoords.map(({ x, y, item }, index) => {
          const isLatest = item.isLatest;
          const isHighRisk = item.score >= 80;
          const isHovered = hoveredIndex === index;
          const showBadge = isLatest || isHighRisk || isHovered;
          const gradeStyle = getRiskGradeStyle(item.score);

          const hoveredCoord = hoveredIndex === null ? null : scoreCoords[hoveredIndex];
          const distanceFromHovered = hoveredCoord
            ? (Math.abs(x - hoveredCoord.x) / width) * containerWidth
            : Number.POSITIVE_INFINITY;
          const shouldShowTimeLabel = isHovered || (
            timeLabelIndexes.has(index)
            && distanceFromHovered >= MIN_TIME_LABEL_GAP_PX
          );

          return (
            <g
              className={`chart-interactive-point chart-score-point ${isHovered ? "point-hovered" : ""}`}
              key={`score-${item.transactionId}-${item.timeLabel}`}
              onClick={() => selectTransactionAndNavigate(item.transactionId)}
              onMouseEnter={() => setHoveredIndex(index)}
              style={{ cursor: "pointer" }}
            >
              {/* 최신 거래 또는 80점 이상 특이점에 펄스 링 표시 */}
              {(isLatest || isHighRisk) && (
                <circle
                  className="live-pulse-ring"
                  cx={x}
                  cy={y}
                  fill="none"
                  r={isLatest ? "9.5" : "8.5"}
                  stroke={gradeStyle.mainColor}
                  strokeOpacity="0.6"
                  strokeWidth={isLatest ? "2" : "1.5"}
                />
              )}

              {/* 포인트 본체 (위험 등급 색상 적용) */}
              <circle
                cx={x}
                cy={y}
                fill={isLatest || isHighRisk ? gradeStyle.mainColor : isHovered ? gradeStyle.mainColor : "#1d1c20"}
                r={isHovered ? "6.5" : showBadge ? "5.5" : "4.5"}
                stroke={gradeStyle.mainColor}
                strokeWidth={isHovered ? "3.5" : "2.5"}
              />

              {/* 점수 뱃지는 최신 거래 또는 호버 시에만 표시 */}
              {(isLatest || isHovered) && (
                <>
                  <rect
                    className={isLatest ? "live-score-badge" : isHighRisk ? "high-risk-badge" : ""}
                    fill={gradeStyle.badgeBg}
                    height="16"
                    rx="4"
                    stroke={gradeStyle.badgeBorder}
                    strokeWidth="1"
                    width="28"
                    x={x - 14}
                    y={y - 24}
                  />
                  <text
                    fill={gradeStyle.textColor}
                    fontSize="9.5"
                    fontWeight="700"
                    pointerEvents="none"
                    textAnchor="middle"
                    x={x}
                    y={y - 13}
                  >
                    {formatRiskScore(item.score)}
                  </text>
                </>
              )}

              {/* X축 시간 라벨 (겹침 없이 깔끔하게 샘플링 렌더링) */}
              {shouldShowTimeLabel && (
                <text
                  className={`chart-axis ${isLatest ? "live-axis-label" : isHovered ? "hover-axis-label" : ""}`}
                  fontWeight={isLatest || isHovered ? "700" : "400"}
                  textAnchor="middle"
                  x={x}
                  y={renderHeight - 8}
                >
                  {item.timeLabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* 스마트 플로팅 툴팁 카드 (위험 등급 뱃지 & 색상 반영) */}
      {activeItem && activeScoreCoord && activeGradeStyle && (
        <div
          className="chart-floating-tooltip"
          ref={tooltipRef}
          style={{
            left: tooltipPosition?.left ?? 0,
            top: tooltipPosition?.top ?? 0,
            borderColor: activeGradeStyle.mainColor,
            visibility: tooltipPosition ? "visible" : "hidden",
          }}
        >
          <div className="tooltip-head">
            <span className="tooltip-tx">TX-{activeItem.transactionId}</span>
            <span className="tooltip-time">{activeItem.dateTimeLabel}</span>
          </div>
          <div className="tooltip-body">
            <div className="tooltip-row">
              <span className="tooltip-label">위험 등급:</span>
              <strong className="tooltip-grade-badge" style={{ color: activeGradeStyle.mainColor }}>
                {activeGradeStyle.gradeText} ({formatRiskScore(activeItem.score)}점)
              </strong>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">거래 금액:</span>
              <strong className="tooltip-amount">{formatNumber(activeItem.amount)}원</strong>
            </div>
          </div>
          <div className="tooltip-action">클릭하여 상세 분석 이동 →</div>
        </div>
      )}
    </div>
  );
}

export function HighRiskTrendPanel({
  rows,
}: {
  rows: CaseListItem[];
}) {
  const [timeInterval, setTimeInterval] = useState<TimeInterval>("second");
  const items = useMemo(
    () => buildRealtimeRiskPoints(rows, timeInterval),
    [rows, timeInterval],
  );
  const peakAmount = useMemo(() => Math.max(...items.map((item) => item.amount), 0), [items]);
  const avgScore = useMemo(
    () => (items.length > 0 ? Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length) : 0),
    [items],
  );

  return (
    <article className="panel priority-panel realtime-risk-panel">
      <div className="panel-head">
        <div className="trend-title-controls">
          <h2>실시간 사기 의심 거래 반영 현황</h2>
          <div className="time-interval-toggle" role="group" aria-label="시간 단위 선택">
            <button
              type="button"
              className={timeInterval === "second" ? "active" : ""}
              onClick={() => setTimeInterval("second")}
            >
              초 단위
            </button>
            <button
              type="button"
              className={timeInterval === "minute" ? "active" : ""}
              onClick={() => setTimeInterval("minute")}
            >
              분 단위
            </button>
          </div>
        </div>

        <div className="trend-panel-meta realtime-trend-meta">
          <span className="live-status-tag">
            <i aria-hidden="true" className="live-green-dot" />
            실시간 감시
          </span>
          <span className="trend-series-label score-legend" title="80점 이상: 심각(레드), 60~79점: 경고(오렌지), 40~59점: 주의(퍼플), 40점 미만: 정상(그린)">
            <span className="grade-color-dots">
              <i className="score-dot dot-critical" />
              <i className="score-dot dot-high" />
              <i className="score-dot dot-medium" />
            </span>
            위험 등급별 점수
          </span>
          <span className="trend-series-label amount-legend">
            <i className="amount-curve-dot" /> 위험 금액 (원)
          </span>
          <div className="trend-stat-badge">
            <span>최고 금액 <strong>{formatCompactMoney(peakAmount)}</strong></span>
            <span className="divider">·</span>
            <span>평균 위험도 <strong className="score-text">{avgScore}점</strong></span>
          </div>
        </div>
        <p className="panel-caption">서버 수신 시각 기준 사기 의심 거래의 금액(원)과 위험 점수 추이 · 점 클릭 시 상세 분석 이동</p>
      </div>
      {items.length > 0 ? (
        <RealtimeRiskTrendChart items={items} />
      ) : (
        <div className="agent-empty">표시할 이상거래가 없습니다.</div>
      )}
    </article>
  );
}
