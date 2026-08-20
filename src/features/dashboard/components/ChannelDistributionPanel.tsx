import type { DistributionItem } from "../dashboardOverviewTypes";
import { formatCompactMoney, formatMoney, formatNumber } from "../dashboardFormatters";

const CHANNEL_NAMES: Record<string, string> = {
  mobile: "모바일",
  internet: "인터넷",
  atm: "ATM",
  others: "기타",
  UNKNOWN: "미분류",
};

function formatChannelName(label: string): string {
  const lower = label.toLowerCase();
  return CHANNEL_NAMES[lower] ?? CHANNEL_NAMES[label] ?? label;
}

// 부채꼴 아크 패스 생성 함수
function createArcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const startRad = (startDeg * Math.PI) / 180;
  const endRad = (endDeg * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

function SolarArcOrbitChart({
  items,
  totalCount,
}: {
  items: DistributionItem[];
  totalCount: number;
}) {
  const topItems = [...items].sort((a, b) => b.count - a.count).slice(0, 4);

  // SVG 뷰박스 및 원점 (이미지와 동일한 웅장하고 시원한 태양계 궤도)
  const width = 360;
  const height = 180;
  const cx = 4;
  const cy = 90;

  // 4개 부채꼴 궤도선 (반지름 및 각도 범위 큼직하게 확대)
  const orbits = [
    { r: 85, startDeg: -38, endDeg: 38, opacity: 0.36 },
    { r: 165, startDeg: -38, endDeg: 38, opacity: 0.28 },
    { r: 245, startDeg: -38, endDeg: 38, opacity: 0.20 },
    { r: 325, startDeg: -38, endDeg: 38, opacity: 0.12 },
  ];

  // 4개 궤도 상의 각도 (위/아래 교차 배치)
  const orbitAngles = [-6, 18, -14, 8];

  const planets = topItems.map((item, index) => {
    const orbit = orbits[index] || orbits[0];
    const angleDeg = orbitAngles[index] ?? 0;
    const rad = (angleDeg * Math.PI) / 180;

    // 점선 궤도선과 정확히 일치하는 중심점
    const x = cx + orbit.r * Math.cos(rad);
    const y = cy + orbit.r * Math.sin(rad);

    // 건수 비중에 정밀 비례하는 크기 계산 (이미지처럼 큼직하고 선명한 3D 행성 구체)
    const count = item.count;
    let r = 11; // 0건 기본 최소 반경

    if (totalCount > 0 && count > 0) {
      const share = count / totalCount; // 0 ~ 1 점유율
      // 최소 14px ~ 최대 38px 범위에서 점유율에 비례
      r = Math.max(14, Math.min(38, 14 + Math.sqrt(share) * 26));
    }

    const displayName = formatChannelName(item.label);
    const ratio = totalCount > 0 ? ((item.count / totalCount) * 100).toFixed(1) : "0.0";
    const isZero = count === 0;

    return {
      x,
      y,
      r,
      item,
      displayName,
      ratio,
      index,
      isZero,
    };
  });

  return (
    <div className="solar-arc-chart-wrap">
      <svg
        aria-label="채널별 태양계 부채꼴 궤도 노출도"
        className="solar-arc-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
      >
        <defs>
          {/* 좌측 태양/코어 방사형 그라디언트 */}
          <radialGradient id="sun-glow-grad" cx="0%" cy="50%" r="100%">
            <stop offset="0%" stopColor="#c548cf" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#7a49dc" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#121217" stopOpacity="0" />
          </radialGradient>

          {/* 3D 행성 구체 그라디언트 4종 */}
          <radialGradient id="planet-sphere-0" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ff7b82" />
            <stop offset="45%" stopColor="#ee4047" />
            <stop offset="100%" stopColor="#8b1117" />
          </radialGradient>

          <radialGradient id="planet-sphere-1" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#e280eb" />
            <stop offset="45%" stopColor="#b640be" />
            <stop offset="100%" stopColor="#580f5f" />
          </radialGradient>

          <radialGradient id="planet-sphere-2" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffbf66" />
            <stop offset="45%" stopColor="#f49121" />
            <stop offset="100%" stopColor="#8f4400" />
          </radialGradient>

          <radialGradient id="planet-sphere-3" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ab87f8" />
            <stop offset="45%" stopColor="#7a49dc" />
            <stop offset="100%" stopColor="#35137a" />
          </radialGradient>
        </defs>

        {/* 1. 좌측 태양(중심 코어) 아크 */}
        <circle cx={cx} cy={cy} fill="url(#sun-glow-grad)" r="45" />
        <circle cx={cx} cy={cy} fill="#c548cf" opacity="0.9" r="8" />
        <circle cx={cx} cy={cy} fill="#ffffff" opacity="0.95" r="3.5" />

        {/* 2. 부채꼴 점선 공전 궤도선 (4중 아크) */}
        {orbits.map((orbit, i) => (
          <path
            key={`orbit-${i}`}
            d={createArcPath(cx, cy, orbit.r, orbit.startDeg, orbit.endDeg)}
            fill="none"
            stroke="#ffffff"
            strokeDasharray="4 4"
            strokeOpacity={orbit.opacity}
            strokeWidth="1.2"
          />
        ))}

        {/* 3. 궤도 점선 위에 정확히 중점이 겹쳐진 행성 버블들 */}
        {planets.map((p) => {
          const titleText = `${p.displayName}: ${formatNumber(p.item.count)}건 (${p.ratio}%) / ${formatMoney(p.item.amount)}`;
          
          return (
            <g className={`solar-planet-group ${p.isZero ? "planet-zero" : ""}`} key={p.item.label}>
              <title>{titleText}</title>

              {/* 행성 외곽 대기 글로우 링 */}
              <circle
                cx={p.x}
                cy={p.y}
                fill="none"
                r={p.r + 2.5}
                stroke={`url(#planet-sphere-${p.index})`}
                strokeOpacity={p.isZero ? "0.2" : "0.4"}
                strokeWidth="1.2"
              />

              {/* 3D 행성 구체 본체 */}
              <circle
                className="planet-circle"
                cx={p.x}
                cy={p.y}
                fill={`url(#planet-sphere-${p.index})`}
                opacity={p.isZero ? 0.75 : 1}
                r={p.r}
              />

              {/* 행성 내부 라벨 (크기에 따라 최적화된 폰트 크기 및 위치) */}
              {p.r >= 26 ? (
                <>
                  <text
                    fill="#ffffff"
                    fontSize="12"
                    fontWeight="700"
                    pointerEvents="none"
                    textAnchor="middle"
                    x={p.x}
                    y={p.y - 2}
                  >
                    {p.displayName}
                  </text>
                  <text
                    fill="#f1f1f7"
                    fontSize="10"
                    fontWeight="500"
                    opacity="0.95"
                    pointerEvents="none"
                    textAnchor="middle"
                    x={p.x}
                    y={p.y + 11}
                  >
                    {p.item.count}건
                  </text>
                </>
              ) : p.r >= 16 ? (
                <>
                  <text
                    fill="#ffffff"
                    fontSize="9.5"
                    fontWeight="700"
                    pointerEvents="none"
                    textAnchor="middle"
                    x={p.x}
                    y={p.y - 1}
                  >
                    {p.displayName}
                  </text>
                  <text
                    fill="#f1f1f7"
                    fontSize="8.5"
                    fontWeight="500"
                    opacity="0.9"
                    pointerEvents="none"
                    textAnchor="middle"
                    x={p.x}
                    y={p.y + 9}
                  >
                    {p.item.count}건
                  </text>
                </>
              ) : p.r >= 12 ? (
                <>
                  <text
                    fill="#ffffff"
                    fontSize="8"
                    fontWeight="700"
                    pointerEvents="none"
                    textAnchor="middle"
                    x={p.x}
                    y={p.y - 1}
                  >
                    {p.displayName}
                  </text>
                  <text
                    fill="#f1f1f7"
                    fontSize="7"
                    fontWeight="500"
                    opacity="0.85"
                    pointerEvents="none"
                    textAnchor="middle"
                    x={p.x}
                    y={p.y + 7.5}
                  >
                    {p.item.count}건
                  </text>
                </>
              ) : (
                /* 0건 등 최소 크기 행성 */
                <>
                  <text
                    fill="#ffffff"
                    fontSize="7"
                    fontWeight="700"
                    pointerEvents="none"
                    textAnchor="middle"
                    x={p.x}
                    y={p.y - 0.5}
                  >
                    {p.displayName}
                  </text>
                  <text
                    fill="#f1f1f7"
                    fontSize="6"
                    fontWeight="500"
                    opacity="0.8"
                    pointerEvents="none"
                    textAnchor="middle"
                    x={p.x}
                    y={p.y + 6.5}
                  >
                    0건
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ChannelBubbles({
  items,
  totalCount,
}: {
  items: DistributionItem[];
  totalCount: number;
}) {
  const topItems = [...items].sort((a, b) => b.count - a.count).slice(0, 4);

  return (
    <div className="channel-vertical-layout">
      {/* 1. 상단: 부채꼴 점선 궤도와 중점이 완벽히 일치하는 태양계 차트 */}
      <SolarArcOrbitChart items={items} totalCount={totalCount} />

      {/* 2. 하단: 막대 그래프 및 상세 통계 리스트 */}
      <div className="channel-stat-list-bottom">
        {topItems.map((item, index) => {
          const displayName = formatChannelName(item.label);
          const ratio = totalCount > 0 ? ((item.count / totalCount) * 100).toFixed(1) : "0.0";

          return (
            <div className="channel-stat-row" key={item.label}>
              <div className="channel-info-main">
                <span className={`channel-dot bubble-${index}`} />
                <span className="channel-name">{displayName}</span>
                <span className="channel-ratio">{ratio}%</span>
              </div>
              <div className="channel-progress-track">
                <span
                  className={`channel-progress-fill bubble-${index}`}
                  style={{ width: `${Math.max(Number(ratio), 4)}%` }}
                />
              </div>
              <div className="channel-info-sub">
                <span className="channel-count">{formatNumber(item.count)}건</span>
                <span className="channel-amount">{formatCompactMoney(item.amount)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChannelDistributionPanel({
  items,
  totalCount,
}: {
  items: DistributionItem[];
  totalCount: number;
}) {
  return (
    <article className="panel channel-panel enhanced-channel-panel">
      <div className="panel-head">
        <div>
          <h2>채널별 의심거래 노출도</h2>
          <p className="panel-caption">채널별 거래량 비중 및 피해 금액 집중도</p>
        </div>
        <div className="channel-total-badge">
          <span>총 <strong>{formatNumber(totalCount)}</strong>건</span>
        </div>
      </div>
      <ChannelBubbles items={items} totalCount={totalCount} />
    </article>
  );
}
