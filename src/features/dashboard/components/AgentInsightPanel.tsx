import type { DashboardAgentInsight } from "../dashboardOverviewTypes";
import { formatDate, formatCompactMoney, formatNumber } from "../dashboardFormatters";

const agentColors = ["#ee4047", "#f49121", "#b640be", "#7a49dc", "#3ec887"];

export type AgentChartDetailItem = {
  label: string;
  currentCount: number;
  previousCount: number;
  increaseCount: number;
  increaseRate: number | null;
  suspiciousAmount: number;
};

// 영문 코드를 자연스러운 한국어로 변환하는 번역 헬퍼
export function toKoreanLabel(rawLabel: string): string {
  const dictionary: Record<string, string> = {
    ANOTHER_PERSON_ACCOUNT: "타인 명의 계좌",
    AUTHENTICATION_CHANGED: "인증 수단 변경",
    NEW_RECIPIENT: "신규 수취 계좌",
    FRAUD_USED_ACCOUNT: "사기 이용 계좌",
    MESSENGER_PHISHING: "메신저피싱",
    ACCOUNT_TAKEOVER: "계정 탈취",
    VOICE_PHISHING: "보이스피싱",
    MALWARE_DETECTED: "악성 앱 감지",
    REMOTE_CONTROL: "원격 제어 앱",
    MULTI_ACCOUNT: "다수 계좌 이체",
    LARGE_WITHDRAWAL: "거액 출금",
    FAST_TRANSFER: "단시간 연속 이체",
    DEVICE_CHANGE: "기기 변경",
    FOREIGN_IP: "해외 IP 접속",
    FIRST_TIME: "최초 거래",
    HIGH_AMOUNT: "고액 이체",
    NIGHT_TIME: "심야 거래",
    NEW_DEVICE: "신규 기기 접속",
    NIGHT: "심야 거래",
    MOBILE: "모바일",
    INTERNET: "인터넷",
    ATM: "ATM",
    BRANCH: "영업점",
    OTHERS: "기타",
    OTHER: "기타",
    LOAN_SCAM: "대출 사기",
    UNKNOWN: "미분류",
  };

  let text = rawLabel;

  // 이전에 오치환되어 DB에 저장되었을 수 있는 깨진 문자열 선제 복구
  text = text
    .replace(/AN기타_PERSON_ACCOUNT/gi, "타인 명의 계좌")
    .replace(/AN기타\s*PERSON\s*ACCOUNT/gi, "타인 명의 계좌")
    .replace(/ANOTHER_PERSON_ACCOUNT/gi, "타인 명의 계좌")
    .replace(/AUTHENTICATION_CHANGED/gi, "인증 수단 변경")
    .replace(/NEW_RECIPIENT/gi, "신규 수취 계좌");

  // 접두사 정리
  text = text
    .replace(/FEATURE:/gi, "")
    .replace(/FRAUD_TYPE:/gi, "")
    .replace(/CHANNEL:/gi, "")
    .replace(/RULE:/gi, "")
    .replace(/LOCATION:GRID_/gi, "지역 ");

  // 길이가 긴 단어부터 우선 치환 (단어 겹침 방지)
  const sortedKeys = Object.keys(dictionary).sort((a, b) => b.length - a.length);
  for (const en of sortedKeys) {
    const ko = dictionary[en];
    const reg = new RegExp(`\\b${en}\\b|${en}`, "gi");
    text = text.replace(reg, ko);
  }

  // 기호 및 띄어쓰기 정리
  text = text
    .replace(/\+/g, " + ")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}

function toAgentDetailItems(insight: DashboardAgentInsight | null): AgentChartDetailItem[] {
  const spec = insight?.chart_spec;
  if (!spec || !Array.isArray(spec.items)) return [];

  const items: AgentChartDetailItem[] = [];

  spec.items.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const source = item as Record<string, unknown>;
    const rawLabel = String(source.label ?? "");
    const currentCount = Number(source.current_count ?? source.increase_count ?? 0);
    const previousCount = Number(source.previous_count ?? 0);
    const increaseCount = Number(source.increase_count ?? (currentCount - previousCount));
    const increaseRate = typeof source.increase_rate === "number" ? source.increase_rate : null;
    const suspiciousAmount = Number(source.suspicious_amount ?? 0);

    if (!rawLabel) return;

    items.push({
      label: toKoreanLabel(rawLabel),
      currentCount,
      previousCount,
      increaseCount,
      increaseRate,
      suspiciousAmount,
    });
  });

  return items
    .sort((a, b) => b.currentCount - a.currentCount || b.increaseCount - a.increaseCount)
    .slice(0, 5);
}

export function AgentInsightPanel({
  insight,
  isRefreshing = false,
  onRefresh,
}: {
  insight: DashboardAgentInsight | null;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}) {
  const items = toAgentDetailItems(insight);
  const maxCount = Math.max(
    ...items.map((item) => Math.max(item.currentCount, item.previousCount)),
    1,
  );

  return (
    <section className="panel agent-panel">
      <div className="agent-panel-head">
        <div>
          <p className="eyebrow">대시보드 AI 분석 에이전트 (DASHBOARD INSIGHT AGENT)</p>
          <h2>{insight?.title ? toKoreanLabel(insight.title) : "AI 에이전트 분석 · 이상징후 급증 조합 TOP 5"}</h2>
          <p className="panel-caption">최근 7일 vs 이전 7일 비교 분석 · 이상거래 급증 원인 조합 TOP 5</p>
        </div>
        <div className="agent-head-actions">
          {onRefresh && (
            <button
              type="button"
              className={`agent-refresh-btn ${isRefreshing ? "is-loading" : ""}`}
              onClick={onRefresh}
              disabled={isRefreshing}
              title="현재 시각 기준 최근 7일과 이전 7일로 기간을 변경하여 에이전트 분석을 새로 실행합니다"
            >
              <i className={`refresh-icon ${isRefreshing ? "spin" : ""}`} />
              <span>{isRefreshing ? "분석 중..." : "에이전트 분석 새로고침"}</span>
            </button>
          )}
          {insight && (
            <span className="status-badge">
              <i />
              최신 분석 완료
            </span>
          )}
        </div>
      </div>

      <div className="agent-summary">
        <div className="agent-summary-head">
          <strong>AI 에이전트 분석 요약</strong>
          <span>
            {insight ? `생성 시각 · ${formatDate(insight.created_at)}` : "분석 대기 중"}
          </span>
        </div>
        <p>{insight?.summary ? toKoreanLabel(insight.summary) : "아직 생성된 AI 에이전트 분석 결과가 없습니다."}</p>
      </div>

      {/* 비교 그래프 영역 */}
      <div className="agent-graph-section">
        <div className="agent-graph-legend">
          <span className="legend-item current">
            <i className="legend-box current-box" /> 최근 7일
          </span>
          <span className="legend-item previous">
            <i className="legend-box prev-box" /> 이전 7일
          </span>
        </div>

        {items.length > 0 ? (
          <div className="agent-bars-comparative">
            {items.map((item, index) => {
              const currentWidth = Math.max((item.currentCount / maxCount) * 100, item.currentCount > 0 ? 4 : 0);
              const prevWidth = Math.max((item.previousCount / maxCount) * 100, item.previousCount > 0 ? 4 : 0);
              const rate = item.increaseRate !== null ? Math.round(item.increaseRate * 100) : null;
              const barColor = agentColors[index % agentColors.length];

              return (
                <div className="agent-comparative-row" key={`${item.label}-${index}`}>
                  <div className="agent-row-title-wrap">
                    <span className="agent-row-label" title={item.label}>
                      {item.label}
                    </span>
                    <div className="agent-row-stats">
                      {rate !== null && rate !== 0 && (
                        <span className={`growth-tag ${rate > 0 ? "positive" : "negative"}`}>
                          {rate > 0 ? `+${rate}%` : `${rate}%`}
                        </span>
                      )}
                      {item.increaseCount > 0 && (
                        <span className="increase-count-tag">
                          (+{item.increaseCount}건↑)
                        </span>
                      )}
                      {item.suspiciousAmount > 0 && (
                        <span className="amount-tag">
                          {formatCompactMoney(item.suspiciousAmount)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 2단 비교 바 (현재 7일 vs 이전 7일) */}
                  <div className="agent-dual-bars">
                    {/* 최근 7일 바 */}
                    <div className="bar-sub-row current-bar-row">
                      <span className="bar-period-tag">최근</span>
                      <div className="bar-track">
                        <i
                          className="bar-fill current-fill"
                          style={{
                            backgroundColor: barColor,
                            width: `${currentWidth}%`,
                          }}
                        />
                      </div>
                      <strong className="bar-val">{formatNumber(item.currentCount)}건</strong>
                    </div>

                    {/* 이전 7일 바 */}
                    <div className="bar-sub-row prev-bar-row">
                      <span className="bar-period-tag">이전</span>
                      <div className="bar-track">
                        <i
                          className="bar-fill prev-fill"
                          style={{
                            width: `${prevWidth}%`,
                          }}
                        />
                      </div>
                      <strong className="bar-val prev-val">{formatNumber(item.previousCount)}건</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="agent-empty">분석된 이상징후 원인 조합 데이터가 없습니다.</div>
        )}
      </div>
    </section>
  );
}
