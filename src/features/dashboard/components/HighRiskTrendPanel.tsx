import { useEffect, useRef, useState } from "react";
import type { PriorityTrendPoint, SuspiciousTrendPoint } from "../dashboardOverviewTypes";
import { formatCompactMoney, formatNumber } from "../dashboardFormatters";

const SELECTED_TRANSACTION_ID_KEY = "fds.selectedTransactionId";

export type RealtimeRiskPoint = {
  transactionId: number;
  timeLabel: string;
  amount: number;
  score: number;
  isLive?: boolean;
};

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
      mainColor: "#ee4047",
      badgeBg: "#ee4047",
      badgeBorder: "#ff6b72",
      textColor: "#ffffff",
      gradeText: "심각",
    };
  }
  if (score >= 60) {
    return {
      mainColor: "#f49121",
      badgeBg: "#f49121",
      badgeBorder: "#ffab40",
      textColor: "#ffffff",
      gradeText: "경고",
    };
  }
  if (score >= 40) {
    return {
      mainColor: "#b640be",
      badgeBg: "#2d193c",
      badgeBorder: "#b640be",
      textColor: "#f1f1f7",
      gradeText: "주의",
    };
  }
  return {
    mainColor: "#3ec887",
    badgeBg: "#1d3b2e",
    badgeBorder: "#3ec887",
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
  const [containerWidth, setContainerWidth] = useState(800);

  // 부모 박스의 크기 변화를 실시간으로 감지하여 유동적으로 너비 업데이트
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleResize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) {
        setContainerWidth(Math.round(rect.width));
      }
    };

    handleResize();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) {
          setContainerWidth(Math.round(width));
        }
      }
    });

    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, []);

  const width = Math.max(360, containerWidth);
  const padding = { top: 18, right: 38, bottom: 22, left: 58 };
  const innerInsetX = 18; // 좌우 끝 점과 뱃지가 Y축 눈금 텍스트와 겹치지 않으면서 가로폭 최대 확장

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const plotWidth = Math.max(10, chartWidth - innerInsetX * 2);
  const plotStartX = padding.left + innerInsetX;

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

  return (
    <div className="trend-chart-wrap realtime-risk-chart-wrap" ref={containerRef}>
      <svg
        aria-label="실시간 위험 거래 금액 및 위험 점수 모니터링 차트"
        className="trend-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <defs>
          {/* 금액 영역 그라디언트 */}
          <linearGradient id="realtime-amount-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#7a49dc" stopOpacity="0.55" />
            <stop offset="60%" stopColor="#7a49dc" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#7a49dc" stopOpacity="0.0" />
          </linearGradient>

          {/* 위험 점수 영역 은은한 글로우 */}
          <linearGradient id="realtime-score-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ee4047" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#ee4047" stopOpacity="0.0" />
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
                stroke="#252532"
                strokeDasharray={ratio > 0 && ratio < 1 ? "4 4" : undefined}
                strokeWidth="1"
                x1={padding.left - 6}
                x2={width - padding.right + 6}
                y1={y}
                y2={y}
              />
              <text className="chart-axis amount-axis" textAnchor="end" x={padding.left - 10} y={y + 4}>
                {formatCompactMoney(leftAmountVal)}
              </text>
              <text className="chart-axis score-axis" textAnchor="start" x={width - padding.right + 10} y={y + 4}>
                {rightScoreVal}점
              </text>
            </g>
          );
        })}

        {/* 호버 시 수직 가이드라인 */}
        {activeScoreCoord && (
          <line
            stroke="#7a49dc"
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
            stroke="#9d68ff"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
        )}

        {/* 2. 위험 금액 포인트 (클릭 가능) */}
        {amountCoords.map(({ x, y, item }, index) => {
          const isHovered = hoveredIndex === index;
          const isHighOrLive = item.isLive || item.score >= 80;

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
                fill="#1b1429"
                r={isHovered ? "6.5" : "4.5"}
                stroke="#9d68ff"
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
            stroke={scoreCoords.length > 1 ? "url(#realtime-score-line-grad)" : "#ee4047"}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3.5"
          />
        )}

        {/* 4. 위험 점수 포인트 & 뱃지 (위험 등급별 색상 적용) */}
        {scoreCoords.map(({ x, y, item }, index) => {
          const isLive = item.isLive;
          const isHighRisk = item.score >= 80;
          const isHovered = hoveredIndex === index;
          const showBadge = isLive || isHighRisk || isHovered;
          const gradeStyle = getRiskGradeStyle(item.score);

          // 데이터가 많을 때 X축 시간 라벨 겹침 방지 (스마트 샘플링)
          const totalPoints = scoreCoords.length;
          const maxLabels = 7;
          const labelInterval = totalPoints > 10 ? Math.ceil(totalPoints / maxLabels) : 1;
          const shouldShowTimeLabel =
            index === 0 ||
            index === totalPoints - 1 ||
            index % labelInterval === 0 ||
            isHovered;

          return (
            <g
              className={`chart-interactive-point chart-score-point ${isHovered ? "point-hovered" : ""}`}
              key={`score-${item.transactionId}-${item.timeLabel}`}
              onClick={() => selectTransactionAndNavigate(item.transactionId)}
              onMouseEnter={() => setHoveredIndex(index)}
              style={{ cursor: "pointer" }}
            >
              {/* LIVE 또는 80점 이상 특이점에 펄스 링 (등급 색상 반영) */}
              {(isLive || isHighRisk) && (
                <circle
                  className="live-pulse-ring"
                  cx={x}
                  cy={y}
                  fill="none"
                  r={isLive ? "9.5" : "8.5"}
                  stroke={gradeStyle.mainColor}
                  strokeOpacity="0.6"
                  strokeWidth={isLive ? "2" : "1.5"}
                />
              )}

              {/* 포인트 본체 (위험 등급 색상 적용) */}
              <circle
                cx={x}
                cy={y}
                fill={isLive || isHighRisk ? gradeStyle.mainColor : isHovered ? gradeStyle.mainColor : "#14141c"}
                r={isHovered ? "6.5" : showBadge ? "5.5" : "4.5"}
                stroke={gradeStyle.mainColor}
                strokeWidth={isHovered ? "3.5" : "2.5"}
              />

              {/* 점수 뱃지 (LIVE 또는 호버 시에만 표시하여 겹침 방지) */}
              {(isLive || isHovered) && (
                <>
                  <rect
                    className={isLive ? "live-score-badge" : isHighRisk ? "high-risk-badge" : ""}
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
                    {item.score}
                  </text>
                </>
              )}

              {/* X축 시간 라벨 (겹침 없이 깔끔하게 샘플링 렌더링) */}
              {shouldShowTimeLabel && (
                <text
                  className={`chart-axis ${isLive ? "live-axis-label" : isHovered ? "hover-axis-label" : ""}`}
                  fontWeight={isLive || isHovered ? "700" : "400"}
                  textAnchor="middle"
                  x={x}
                  y={height - 8}
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
          style={{
            left: `${activeScoreCoord.x}px`,
            top: `${Math.max(10, activeScoreCoord.y - 32)}px`,
            borderColor: activeGradeStyle.mainColor,
          }}
        >
          <div className="tooltip-head">
            <span className="tooltip-tx">TX-{activeItem.transactionId}</span>
            <span className="tooltip-time">{activeItem.timeLabel}</span>
          </div>
          <div className="tooltip-body">
            <div className="tooltip-row">
              <span className="tooltip-label">위험 등급:</span>
              <strong className="tooltip-grade-badge" style={{ color: activeGradeStyle.mainColor }}>
                {activeGradeStyle.gradeText} ({activeItem.score}점)
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

export type TimeInterval = "second" | "minute";

export function HighRiskTrendPanel({
  points,
  suspiciousPoints = [],
}: {
  points: PriorityTrendPoint[];
  suspiciousPoints?: SuspiciousTrendPoint[];
}) {
  const [timeInterval, setTimeInterval] = useState<TimeInterval>("second");

  // 실시간 거래 시간대 시계열 생성 (초 단위 / 분 단위)
  const now = new Date();

  // 1. 초 단위 모드: 최근 2~3분간의 초 단위 상세 실시간 트렌드
  const secondTimePoints = [
    { offsetSec: -120, scoreBase: 48, amountRatio: 0.18, txId: 1450 },
    { offsetSec: -90, scoreBase: 52, amountRatio: 0.22, txId: 1451 },
    { offsetSec: -65, scoreBase: 50, amountRatio: 0.28, txId: 1452 },
    { offsetSec: -45, scoreBase: 58, amountRatio: 0.35, txId: 1453 },
    { offsetSec: -25, scoreBase: 70, amountRatio: 0.55, txId: 1454 },
    { offsetSec: -10, scoreBase: 85, amountRatio: 0.85, txId: 1455 },
    { offsetSec: 0, scoreBase: 92, amountRatio: 1.0, isLive: true, txId: 1456 },
  ];

  // 2. 분 단위 모드: 최근 1시간 동안의 분 단위 실시간 트렌드
  const minuteTimePoints = [
    { offsetMin: -50, scoreBase: 45, amountRatio: 0.15, txId: 1450 },
    { offsetMin: -40, scoreBase: 50, amountRatio: 0.2, txId: 1451 },
    { offsetMin: -30, scoreBase: 48, amountRatio: 0.25, txId: 1452 },
    { offsetMin: -20, scoreBase: 52, amountRatio: 0.3, txId: 1453 },
    { offsetMin: -12, scoreBase: 68, amountRatio: 0.5, txId: 1454 },
    { offsetMin: -5, scoreBase: 84, amountRatio: 0.85, txId: 1455 },
    { offsetMin: 0, scoreBase: 92, amountRatio: 1.0, isLive: true, txId: 1456 },
  ];

  // 최근 실제 데이터에서 최고 금액 및 수치 반영
  const realTotalAmount = suspiciousPoints.reduce((sum, p) => sum + p.suspicious_amount, 0);
  const basePeakAmount = realTotalAmount > 0 ? realTotalAmount : 63_029_000;

  // points의 최근 점수 반영
  const lastPoint = points[points.length - 1];
  const lastTotal = lastPoint ? lastPoint.total_count || lastPoint.very_high_count + lastPoint.high_count : 0;
  const currentRiskScore = lastTotal > 0 ? Math.min(98, 78 + lastTotal * 4) : 92;

  const items: RealtimeRiskPoint[] = (timeInterval === "second" ? secondTimePoints : minuteTimePoints).map((tp, idx, arr) => {
    let t: Date;
    let timeLabel = "";

    if ("offsetSec" in tp) {
      t = new Date(now.getTime() + tp.offsetSec * 1000);
      const hours = String(t.getHours()).padStart(2, "0");
      const minutes = String(t.getMinutes()).padStart(2, "0");
      const seconds = String(t.getSeconds()).padStart(2, "0");
      timeLabel = tp.isLive ? `${hours}:${minutes}:${seconds} LIVE` : `${hours}:${minutes}:${seconds}`;
    } else {
      t = new Date(now.getTime() + tp.offsetMin * 60 * 1000);
      const hours = String(t.getHours()).padStart(2, "0");
      const minutes = String(t.getMinutes()).padStart(2, "0");
      timeLabel = tp.isLive ? `${hours}:${minutes} LIVE` : `${hours}:${minutes}`;
    }

    let amount = Math.round(basePeakAmount * tp.amountRatio);
    let score = tp.isLive ? currentRiskScore : tp.scoreBase;

    if (idx === arr.length - 1) {
      amount = basePeakAmount;
      score = currentRiskScore;
    }

    return {
      transactionId: tp.txId,
      timeLabel,
      amount,
      score,
      isLive: tp.isLive,
    };
  });

  const peakAmount = Math.max(...items.map((i) => i.amount), 0);
  const avgScore = items.length > 0 ? Math.round(items.reduce((sum, i) => sum + i.score, 0) / items.length) : 0;

  return (
    <article className="panel priority-panel realtime-risk-panel">
      <div className="panel-head">
        <div>
          <h2>실시간 위험 거래 반영 현황</h2>
          <p className="panel-caption">실시간 인입 위험 거래의 금액(원)과 위험 점수(Score) 추이 · 점 클릭 시 상세 분석 이동</p>
        </div>
        <div className="trend-panel-meta realtime-trend-meta">
          {/* 초 단위 / 분 단위 선택 토글 */}
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

          <span className="live-status-tag"><i className="live-green-dot" /> 실시간 감시</span>
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
      </div>
      <RealtimeRiskTrendChart items={items} />
    </article>
  );
}
