import { useEffect, useMemo, useState } from "react";

import { CaseAnalysisPageShell } from "../caseAnalysis/CaseAnalysisPageShell";
import type {
  CaseReviewUpsertRequest,
  ReviewDecision,
  RuleEvidence,
  TransactionView,
} from "./caseDetailTypes";
import { useCaseDetail } from "./useCaseDetail";
import "./CaseDetailPage.css";
import "./CaseDetailPageResponsive.css";

const SELECTED_TRANSACTION_ID_KEY = "fds.selectedTransactionId";

const RULE_LABELS: Record<string, string> = {
  VOICE_PHISHING: "보이스피싱",
  ACCOUNT_TAKEOVER: "계정 탈취",
  FRAUD_USED_ACCOUNT: "사기 이용 계좌",
  MESSENGER_PHISHING: "메신저피싱",
  UNCLASSIFIED: "유형 미분류",
  severe_amount_context: "고액 거래 정황",
  recipient_transfer_with_severe_amount: "고액 수취계좌 이체",
  new_recipient: "신규 수취인",
  remote_control: "원격제어 정황",
  unused_account: "장기 미사용 계좌",
  unused_terminal: "장기 미사용 단말",
  high_amount: "고액 거래",
};

const CONFIRMED_FRAUD_TYPES = [
  "VOICE_PHISHING",
  "MESSENGER_PHISHING",
  "ACCOUNT_TAKEOVER",
  "FRAUD_USED_ACCOUNT",
] as const;

const DECISION_LABELS: Record<ReviewDecision, string> = {
  CONFIRMED_FRAUD: "사기 확정",
  FALSE_POSITIVE: "정상 거래",
  ON_HOLD: "판정 보류",
};

function getTransactionId() {
  const hashQuery = window.location.hash.split("?")[1];
  const urlTransactionId = Number(new URLSearchParams(hashQuery).get("transaction_id"));
  if (Number.isInteger(urlTransactionId) && urlTransactionId > 0) return urlTransactionId;

  const storedId = Number(sessionStorage.getItem(SELECTED_TRANSACTION_ID_KEY));
  return Number.isInteger(storedId) && storedId > 0 ? storedId : null;
}

function formatPercent(value: number | null) {
  return value === null ? "데이터 없음" : `${(value * 100).toFixed(1)}%`;
}

function formatAmount(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("ko-KR") : "데이터 없음";
}

function formatLocation(transaction: TransactionView) {
  if (transaction.location_lat === null || transaction.location_lon === null) {
    return "데이터 없음";
  }
  return `${transaction.location_lat}, ${transaction.location_lon}`;
}

function translateRule(value: string) {
  return RULE_LABELS[value] ?? value.replaceAll("_", " ");
}

function riskClass(grade: string | null) {
  if (grade === "VERY_HIGH") return "very-high";
  if (grade === "HIGH") return "high";
  if (grade === "MEDIUM") return "medium";
  return "low";
}

function EmptyData({ message = "현재 연동된 데이터가 없습니다." }: { message?: string }) {
  return <div className="case-empty"><span>—</span><p>데이터 없음</p><small>{message}</small></div>;
}

function RuleEvidenceList({
  components,
}: {
  components?: RuleEvidence[] | Record<string, string[]>;
}) {
  const entries: RuleEvidence[] = Array.isArray(components)
    ? components
    : Object.entries(components ?? {}).flatMap(([fraudType, codes]) =>
        codes.map((code) => ({
          fraud_type: fraudType,
          evidence_code: code,
          observed_value: true,
          contribution: 0.05,
        })),
      );

  if (entries.length === 0) return <EmptyData message="적중한 Rule 근거가 없습니다." />;

  return (
    <div className="j-evidence-wrap">
      {entries.slice(0, 4).map((evidence) => {
        const displayScore = (evidence.contribution > 0 ? evidence.contribution : 0.05).toFixed(2);
        return (
          <div className="j-evidence-row" key={`${evidence.fraud_type}-${evidence.evidence_code}`}>
            <span className="j-evidence-tag">{translateRule(evidence.fraud_type)}</span>
            <span className="j-evidence-desc">
              {evidence.evidence_code.replaceAll("_", " ")} · +{displayScore}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DeviceRiskInfo({ transaction }: { transaction: TransactionView | null }) {
  if (!transaction) return <EmptyData message="단말·접속 정보를 불러오지 못했습니다." />;

  const signals = [
    ["루팅·탈옥", transaction.rooting_jailbreak_indicator],
    ["로밍", transaction.mobile_roaming_indicator],
    ["VPN", transaction.vpn_indicator],
    ["악성 단말행위", transaction.terminal_malicious_behavior_detected],
  ] as const;

  return (
    <div className="device-risk-content">
      <dl className="device-definition">
        <div><dt>IP</dt><dd>{transaction.ip_address ?? "데이터 없음"}</dd></div>
        <div><dt>운영체제</dt><dd>{transaction.operating_system ?? "데이터 없음"}</dd></div>
        <div><dt>접속 매체</dt><dd>{transaction.access_medium ?? "데이터 없음"}</dd></div>
        <div><dt>MAC</dt><dd>{transaction.mac_address ?? "데이터 없음"}</dd></div>
        <div><dt>연결 실패</dt><dd>{transaction.num_connection_failure}회</dd></div>
      </dl>
      <div className="signal-list">
        {signals.map(([label, active]) => (
          <span className={active ? "active" : ""} key={label}>{label} {active ? "탐지" : "미탐지"}</span>
        ))}
      </div>
    </div>
  );
}

type WorkflowStage = 1 | 2 | 3;

const WORKFLOW_STAGES = [
  {
    id: 1 as WorkflowStage,
    code: "01 · FACT VERIFICATION",
    title: "거래 상세 정보 확인",
    description: "거래 팩트, AI 판정, Rule·접속 신호를 먼저 확인합니다.",
    workspace: "거래 상세 정보 확인",
  },
  {
    id: 2 as WorkflowStage,
    code: "02 · RESPONSE GUIDE",
    title: "체크리스트 확인 및 가이드 수행",
    description: "권장 조치와 필수 점검 항목을 순서대로 수행합니다.",
    workspace: "체크리스트 확인 및 가이드 수행",
  },
  {
    id: 3 as WorkflowStage,
    code: "03 · FINAL DECISION",
    title: "사기 여부 확정 및 처리",
    description: "판정과 조치 사유를 기록하고 사건 처리를 완료합니다.",
    workspace: "최종 판정 및 처리",
  },
] as const;

function CaseWorkflowCards({
  activeStep,
  checkedCount,
  checklistCount,
  currentStep,
  guideCount,
  onSelect,
}: {
  activeStep: WorkflowStage;
  checkedCount: number;
  checklistCount: number;
  currentStep: WorkflowStage;
  guideCount: number;
  onSelect: (step: WorkflowStage) => void;
}) {
  return (
    <section className="j-workflow-cards" aria-label="사건 처리 단계">
      {WORKFLOW_STAGES.map((stage) => {
        const state = stage.id < currentStep ? "done" : stage.id === currentStep ? "current" : "pending";
        const status = state === "done" ? "완료" : state === "current" ? "진행 중" : "대기";
        const detail = stage.id === 1
          ? `점검 ${checkedCount}/${checklistCount} 완료`
          : stage.id === 2
            ? `권장 조치 ${guideCount}개`
            : state === "done" ? "처리 기록 저장됨" : "판정 및 사유 입력 필요";

        return (
          <button
            aria-pressed={activeStep === stage.id}
            className={`j-workflow-card ${state} ${activeStep === stage.id ? "active" : ""}`}
            key={stage.id}
            onClick={() => onSelect(stage.id)}
            type="button"
          >
            <span className="j-workflow-code">{stage.code}</span>
            <strong>{stage.title}</strong>
            <span className="j-workflow-description">{stage.description}</span>
            <span className="j-workflow-footer">
              <em>{status}</em>
              <small>{detail}</small>
            </span>
          </button>
        );
      })}
    </section>
  );
}

function CaseActivityHistory({
  transactionTime,
  agentStatus,
  reviewerId,
  reviewedAt,
  reviewDecision,
  resolutionSummary,
}: {
  transactionTime: string | null;
  agentStatus: string;
  reviewerId: string | null | undefined;
  reviewedAt: string | null | undefined;
  reviewDecision: ReviewDecision | null;
  resolutionSummary: string | null | undefined;
}) {
  return (
    <article className="j-card j-history-card j-stage-guide j-stage-decision">
      <header className="j-card-header">
        <div className="j-title-wrap">
          <span className="j-section-tag">CASE ACTIVITY</span>
          <h2>처리 이력</h2>
        </div>
      </header>
      <div className="j-card-body">
        <ol className="j-activity-list">
          <li>
            <time>{formatDate(transactionTime)}</time>
            <div><strong>시스템</strong><span>의심 거래가 접수되었습니다.</span></div>
          </li>
          <li>
            <time>현재 상태</time>
            <div><strong>AI Agent</strong><span>사건 분석 상태: {agentStatus}</span></div>
          </li>
          {reviewDecision && (
            <li>
              <time>{formatDate(reviewedAt ?? null)}</time>
              <div>
                <strong>{reviewerId ?? "담당자 정보 없음"}</strong>
                <span>{DECISION_LABELS[reviewDecision]}으로 처리했습니다.{resolutionSummary ? ` ${resolutionSummary}` : ""}</span>
              </div>
            </li>
          )}
        </ol>
      </div>
    </article>
  );
}

export function CaseDetailPage() {
  const transactionId = useMemo(getTransactionId, []);
  const {
    detail,
    isLoading,
    errorMessage,
    isSaving,
    saveError,
    saveReview,
  } = useCaseDetail(transactionId);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [decision, setDecision] = useState<ReviewDecision>("ON_HOLD");
  const [confirmedFraudType, setConfirmedFraudType] = useState("");
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isGuideDetailsOpen, setIsGuideDetailsOpen] = useState(false);
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<WorkflowStage>(1);

  useEffect(() => {
    const review = detail?.review.data;
    const responsePlan = detail?.case_agent.data?.response_result;

    setDecision(review?.decision ?? "ON_HOLD");
    setConfirmedFraudType(
      review?.confirmed_fraud_type
      ?? responsePlan?.applied_fraud_type
      ?? "",
    );
    setResolutionSummary(review?.resolution_summary ?? "");
    setIsGuideDetailsOpen(false);
    setIsChatOpen(false);
    setActiveWorkflowStep(review ? 3 : 1);
    setCheckedItems(new Set(
      (review?.checklist_results ?? [])
        .filter((item) => item.checked ?? item.cheked ?? false)
        .map((item) => item.item_code),
    ));
  }, [detail?.case_id]);

  useEffect(() => {
    if (!isGuideDetailsOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsGuideDetailsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isGuideDetailsOpen]);

  if (transactionId === null) {
    return <CaseAnalysisPageShell activeSection="detail" contentClassName="case-content" headerClassName="case-header"><main className="case-state">거래 탐색 탭에서 분석할 거래를 먼저 선택해주세요.</main></CaseAnalysisPageShell>;
  }
  if (isLoading) return <CaseAnalysisPageShell activeSection="detail" contentClassName="case-content" headerClassName="case-header"><main className="case-state">사건 상세 정보를 불러오는 중...</main></CaseAnalysisPageShell>;
  if (errorMessage || !detail) {
    return <CaseAnalysisPageShell activeSection="detail" contentClassName="case-content" headerClassName="case-header"><main className="case-state">오류: {errorMessage ?? "표시할 사건 데이터가 없습니다."}</main></CaseAnalysisPageShell>;
  }

  const caseId = detail.case_id;
  const transaction = detail.transaction.data;
  const ml = detail.ml.data;
  const agent = detail.case_agent.data;
  const ruleResult = agent?.rule_result;
  const typeScores = Object.entries(ruleResult?.type_scores ?? {})
    .sort(([, left], [, right]) => right - left)
    .slice(0, 4);
  const maxTypeScore = Math.max(...typeScores.map(([, score]) => score), 0.01);
  const responsePlan = agent?.response_result;
  const checklist = responsePlan?.checklist ?? [];
  const recommendedActions = responsePlan?.recommended_actions ?? [];
  const similarCases = agent?.similar_case_results ?? [];
  const chat = detail.chat.data;
  // 거래 탐색의 예상 사기유형과 같은 Agent 대응 유형을 표시한다.
  const inferredFraudType = responsePlan?.applied_fraud_type
    ?? ruleResult?.primary_fraud_type
    ?? "UNCLASSIFIED";
  const reviewerFraudType = detail.review.data?.decision === "CONFIRMED_FRAUD"
    ? detail.review.data.confirmed_fraud_type ?? "확정 유형 미선택"
    : detail.review.data?.decision === "FALSE_POSITIVE"
      ? "정상 거래"
      : detail.review.data?.decision === "ON_HOLD"
        ? "판정 보류"
        : "최종 판정 전";
  const chatFraudType = [...(chat?.type_scores ?? [])]
    .sort((left, right) => right.score - left.score)[0]?.display_name ?? "데이터 없음";
  const riskGrade = agent?.risk_grade ?? "데이터 없음";
  const investigationReason = typeof agent?.investigation_result?.recommendation_reason === "string"
    ? agent.investigation_result.recommendation_reason
    : "추가 조사 결과가 없습니다.";
  const workflowStep: WorkflowStage = detail.review.status === "AVAILABLE"
    ? 3
    : checklist.length > 0 && checkedItems.size === checklist.length
      ? 2
      : 1;

  function toggleSet(
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    value: string,
  ) {
    setter((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
    setSaveMessage(null);
  }

  async function handleReviewSave() {
    const request: CaseReviewUpsertRequest = {
      decision,
      confirmed_fraud_type: decision === "CONFIRMED_FRAUD"
        ? confirmedFraudType.trim()
        : null,
      performed_actions: [],
      checklist_results: checklist.map((item) => ({
        item_code: item.item_code,
        checked: checkedItems.has(item.item_code),
      })),
      resolution_summary: resolutionSummary.trim() || null,
    };

    setSaveMessage(null);
    try {
      await saveReview(caseId, request);
      setSaveMessage("최종 판정이 성공적으로 저장되었습니다.");
    } catch {
      setSaveMessage(null);
    }
  }

  return (
    <CaseAnalysisPageShell
      activeSection="detail"
      contentClassName="case-content"
      headerClassName="case-header"
    >
      {/* 1. 상단 프로파일 헤더 바 */}
      <section className="j-profile-header">
        <div className="j-header-meta">
          <span className="j-meta-label">CASE ID</span>
          <strong className="j-meta-value mono">{detail.case_id}</strong>
          <span className="j-meta-sub">거래 #{detail.transaction_id}</span>
        </div>

        <div className={`j-status-chip ${riskClass(agent?.risk_grade ?? null)}`}>
          <span className="j-status-dot" />
          <div className="j-status-text">
            <span className="j-status-label">위험등급</span>
            <strong className="j-status-val">{riskGrade}</strong>
          </div>
          <span className="j-status-score">{agent?.risk_score ?? "—"}점</span>
        </div>

        <div className="j-header-meta">
          <span className="j-meta-label">룰 규칙 추론 사기 유형</span>
          <strong className="j-meta-highlight">
            {translateRule(inferredFraudType)}
          </strong>
        </div>

        <div className="j-header-meta">
          <span className="j-meta-label">채팅으로 추론된 사기유형</span>
          <strong className="j-meta-highlight">{chatFraudType}</strong>
        </div>

        <div className="j-header-meta">
          <span className="j-meta-label">담당자 최종 판정 유형</span>
          <strong className="j-meta-highlight">{translateRule(reviewerFraudType)}</strong>
        </div>
      </section>

      <CaseWorkflowCards
        activeStep={activeWorkflowStep}
        checkedCount={checkedItems.size}
        checklistCount={checklist.length}
        currentStep={workflowStep}
        guideCount={recommendedActions.length}
        onSelect={setActiveWorkflowStep}
      />

      <section className="j-stage-workspace">
      {/* 선택한 처리 단계에 필요한 카드만 표시한다. */}
      <section className={`j-dashboard-grid j-stage-grid stage-${activeWorkflowStep}`}>
        {/* Card 1: AI 종합 판정 브리핑 */}
        <article className="j-card j-verdict-card j-stage-check">
          <header className="j-card-header">
            <div className="j-title-wrap">
              <span className="j-section-tag">AI AGENT VERDICT</span>
              <h2>AI 종합 판정 브리핑</h2>
            </div>
            <span className="j-badge-pulse-indicator" />
          </header>

          <div className="j-card-body">
            <div className="j-score-hero">
              <div className="j-score-display">
                <strong className="j-score-number">{agent?.risk_score ?? "—"}</strong>
                <div className="j-score-badge-wrap">
                  <span className={`j-risk-grade-badge ${riskClass(agent?.risk_grade ?? null)}`}>
                    {riskGrade}
                  </span>
                  <small className="j-risk-grade-sub">종합 위험도</small>
                </div>
              </div>
              <div className="j-verdict-tag-wrap">
                <span className="j-verdict-tag-label">판정 명의</span>
                <strong className="j-verdict-tag-val">
                  {translateRule(responsePlan?.applied_fraud_type ?? ruleResult?.primary_fraud_type ?? "데이터 없음")}
                </strong>
              </div>
            </div>

            <div className="j-callout-box">
              <p className="j-callout-text">
                {responsePlan?.summary
                  ?? (ml ? `ML 사기 예측 확률 ${formatPercent(ml.fraud_probability)}와 사기 이용 계좌 룰 매칭을 근거로 이상거래 가능성이 높은 사건입니다.` : "AI 분석 데이터가 준비 중입니다.")}
              </p>
            </div>

            {/* 과거 유사 사례 공통 정황 및 비슷한 점 박스 */}
            <div className="j-similar-box">
              <div className="j-similar-head">
                <div className="j-similar-title-wrap">
                  <span aria-hidden="true" className="j-similar-icon">AI</span>
                  <span className="j-similar-label">과거 유사 사례 분석</span>
                </div>
                {similarCases.length > 0 ? (
                  <span className="j-similar-score">Top 유사도 {formatPercent(similarCases[0].similarity_score)}</span>
                ) : (
                  <span className="j-similar-score muted">패턴 매칭</span>
                )}
              </div>
              <div className="j-similar-content">
                {similarCases.length > 0 ? (
                  similarCases.slice(0, 2).map((item) => (
                    <div className="j-similar-item" key={item.similar_case_id}>
                      <span className="j-similar-case-id">#{item.similar_case_id}</span>
                      <p className="j-similar-reason">
                        <strong className="j-similar-highlight">비슷한 점:</strong> {item.similarity_reason}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="j-similar-item">
                    <p className="j-similar-reason">
                      <strong className="j-similar-highlight">비슷한 점:</strong> {investigationReason}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="j-signals-dual">
              <div className="j-signal-box ml">
                <span className="j-signal-dot" />
                <div>
                  <span className="j-signal-lbl">ML 예측 확률</span>
                  <strong className="j-signal-val">{formatPercent(ml?.fraud_probability ?? null)} (이상 거래 감지)</strong>
                </div>
              </div>
              <div className="j-signal-box rule">
                <span className="j-signal-dot" />
                <div>
                  <span className="j-signal-lbl">주요 Rule 적중</span>
                  <strong className="j-signal-val">
                    {translateRule(ruleResult?.primary_fraud_type ?? "없음")} (+0.05)
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </article>

        {/* Card 2: 거래 팩트 증거 */}
        <article className="j-card j-tx-card j-stage-check">
          <header className="j-card-header">
            <div className="j-title-wrap">
              <span className="j-section-tag">TRANSACTION EVIDENCE</span>
              <h2>거래 팩트 증거</h2>
            </div>
          </header>

          <div className="j-card-body">
            <div className="j-amount-banner">
              <div>
                <span className="j-amount-lbl">거래 금액</span>
                <strong className="j-amount-val">
                  {transaction ? formatAmount(transaction.transaction_amount) : "—"}
                </strong>
              </div>
              <span className="j-channel-chip">{transaction?.channel ?? "MOBILE"}</span>
            </div>

            {transaction ? (
              <div className="j-key-value-grid">
                <div className="j-kv-item">
                  <span className="j-kv-label">거래 시각</span>
                  <strong className="j-kv-value">{formatDate(transaction.transaction_datetime)}</strong>
                </div>
                <div className="j-kv-item">
                  <span className="j-kv-label">고객 ID</span>
                  <strong className="j-kv-value">{transaction.customer_id ?? "—"}</strong>
                </div>
                <div className="j-kv-item">
                  <span className="j-kv-label">출금 계좌</span>
                  <strong className="j-kv-value mono">{transaction.source_account_number}</strong>
                </div>
                <div className="j-kv-item highlight-danger">
                  <span className="j-kv-label">수취 계좌</span>
                  <strong className="j-kv-value mono danger">{transaction.recipient_account_number}</strong>
                </div>
                <div className="j-kv-item full-width">
                  <span className="j-kv-label">접속 위치</span>
                  <strong className="j-kv-value mono">{formatLocation(transaction)}</strong>
                </div>
              </div>
            ) : (
              <EmptyData message="거래 원천 데이터를 불러오지 못했습니다." />
            )}
          </div>
        </article>

        {/* Card 3: 대응 가이드 & 점검표 */}
        <article className="j-card j-guide-card j-stage-guide">
          <header className="j-card-header">
            <div className="j-title-wrap">
              <span className="j-section-tag">AGENT RESPONSE PLAN</span>
              <h2>대응 가이드 & 점검표</h2>
            </div>
            <span className="j-card-badge primary">
              {checkedItems.size}/{checklist.length} 완료
            </span>
          </header>

          <div className="j-card-body">
            {recommendedActions.length > 0 ? (
              <ol className="j-action-step-list">
                {recommendedActions.slice(0, 2).map((action, index) => (
                  <li key={action.action_code || index}>
                    <span className="j-step-num">{index + 1}</span>
                    <div className="j-step-content">
                      <strong>{action.action}</strong>
                      {action.reason && <p>{action.reason}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyData message="권장 조치 내역이 없습니다." />
            )}

            {checklist.length > 0 && (
              <div className="j-checklist-section">
                <ul className="j-checklist">
                  {checklist.map((item) => {
                    const isChecked = checkedItems.has(item.item_code);
                    return (
                      <li className={`j-check-item ${isChecked ? "checked" : ""}`} key={item.item_code}>
                        <label>
                          <input
                            checked={isChecked}
                            onChange={() => toggleSet(setCheckedItems, item.item_code)}
                            type="checkbox"
                          />
                          <span>{item.label}</span>
                        </label>
                        {item.required && <span className="j-required-badge">필수</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {responsePlan && (
              <>
                <button
                  className="j-btn-detail-toggle"
                  onClick={() => setIsGuideDetailsOpen(true)}
                  type="button"
                >
                  대응 가이드 자세히 보기
                </button>
              </>
            )}
          </div>
        </article>

        <CaseActivityHistory
          agentStatus={agent?.execution_status ?? detail.case_agent.status}
          resolutionSummary={detail.review.data?.resolution_summary}
          reviewDecision={detail.review.data?.decision ?? null}
          reviewedAt={detail.review.data?.reviewed_at}
          reviewerId={detail.review.data?.reviewer_id}
          transactionTime={transaction?.transaction_datetime ?? null}
        />

        {/* Card 4: Rule 엔진 & 모델 기여도 */}
        <article className="j-card j-signals-card j-stage-check">
          <header className="j-card-header">
            <div className="j-title-wrap">
              <span className="j-section-tag">RULE & ML SIGNALS</span>
              <h2>Rule 엔진 & 모델 기여도</h2>
            </div>
            <span className="j-card-badge">종합 분석</span>
          </header>

          <div className="j-card-body">
            {typeScores.length > 0 ? (
              <div className="j-progress-list">
                {typeScores.map(([name, score]) => (
                  <div className="j-progress-row" key={name}>
                    <span className="j-prog-name">{translateRule(name)}</span>
                    <div className="j-prog-track">
                      <div
                        className="j-prog-bar"
                        style={{ width: `${Math.min(100, (score / maxTypeScore) * 100)}%` }}
                      />
                    </div>
                    <strong className="j-prog-val">{score.toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyData message="산출된 사기 유형별 점수가 없습니다." />
            )}

            <div className="j-card-divider" />
            <RuleEvidenceList components={ruleResult?.matched_components} />
          </div>
        </article>

        {/* Card 5: 단말 · 접속 보안 신호 */}
        <article className="j-card j-device-card j-stage-check">
          <header className="j-card-header">
            <div className="j-title-wrap">
              <span className="j-section-tag">DEVICE & NETWORK SIGNALS</span>
              <h2>단말 · 접속 보안 신호</h2>
            </div>
          </header>

          <div className="j-card-body">
            {transaction ? (
              <>
                <div className="j-key-value-grid">
                  <div className="j-kv-item">
                    <span className="j-kv-label">IP</span>
                    <strong className="j-kv-value">{transaction.ip_address ?? "—"}</strong>
                  </div>
                  <div className="j-kv-item">
                    <span className="j-kv-label">운영체제</span>
                    <strong className="j-kv-value">{transaction.operating_system ?? "—"}</strong>
                  </div>
                  <div className="j-kv-item">
                    <span className="j-kv-label">접속 매체</span>
                    <strong className="j-kv-value">{transaction.access_medium ?? "—"}</strong>
                  </div>
                  <div className="j-kv-item">
                    <span className="j-kv-label">MAC</span>
                    <strong className="j-kv-value mono">{transaction.mac_address ?? "—"}</strong>
                  </div>
                  <div className="j-kv-item full-width">
                    <span className="j-kv-label">연결 실패</span>
                    <strong className="j-kv-value">{transaction.num_connection_failure}회</strong>
                  </div>
                </div>

                <div className="j-card-divider" />
                <div className="j-chips-row">
                  {[
                    ["루팅·탈옥", transaction.rooting_jailbreak_indicator],
                    ["로밍", transaction.mobile_roaming_indicator],
                    ["VPN", transaction.vpn_indicator],
                    ["악성 단말행위", transaction.terminal_malicious_behavior_detected],
                  ].map(([label, active]) => (
                    <span className={`j-chip ${active ? "active danger" : ""}`} key={label as string}>
                      <i className="j-chip-dot" />
                      {label} {active ? "탐지" : "미탐지"}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <EmptyData message="단말·접속 정보를 불러오지 못했습니다." />
            )}
          </div>
        </article>

        {/* Card 6: 최종 판정 및 즉각 조치 */}
        <article className="j-card j-action-card j-stage-decision">
          <header className="j-card-header">
            <div className="j-title-wrap">
              <span className="j-section-tag">REVIEW & DECISION</span>
              <h2>최종 판정 및 즉각 조치</h2>
            </div>
          </header>

          <div className="j-card-body">
            <div className="j-decision-box">
              <div className="j-decision-segmented">
                <button
                  className={`j-seg-btn fraud ${decision === "CONFIRMED_FRAUD" ? "selected" : ""}`}
                  onClick={() => { setDecision("CONFIRMED_FRAUD"); setSaveMessage(null); }}
                  type="button"
                >
                  <span className="j-seg-dot" />
                  <span>사기 확정 (차단)</span>
                </button>
                <button
                  className={`j-seg-btn normal ${decision === "FALSE_POSITIVE" ? "selected" : ""}`}
                  onClick={() => { setDecision("FALSE_POSITIVE"); setSaveMessage(null); }}
                  type="button"
                >
                  <span className="j-seg-dot" />
                  <span>정상 거래</span>
                </button>
                <button
                  className={`j-seg-btn hold ${decision === "ON_HOLD" ? "selected" : ""}`}
                  onClick={() => { setDecision("ON_HOLD"); setSaveMessage(null); }}
                  type="button"
                >
                  <span className="j-seg-dot" />
                  <span>판정 보류</span>
                </button>
              </div>

              {decision === "CONFIRMED_FRAUD" && (
                <div className="j-form-field">
                  <label className="j-field-label">확정 사기유형</label>
                  <div aria-label="확정 사기유형 선택" className="j-fraud-type-options" role="group">
                    {CONFIRMED_FRAUD_TYPES.map((fraudType) => (
                      <button
                        aria-pressed={confirmedFraudType === fraudType}
                        className={confirmedFraudType === fraudType ? "selected" : ""}
                        key={fraudType}
                        onClick={() => { setConfirmedFraudType(fraudType); setSaveMessage(null); }}
                        type="button"
                      >
                        {translateRule(fraudType)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="j-form-field">
                <label className="j-field-label">처리 근거 (조치 사유)</label>
                <textarea
                  className="j-textarea"
                  onChange={(event) => setResolutionSummary(event.target.value)}
                  placeholder="판정 및 조치 근거를 입력하세요 (예: 단말 인증 변경 확인 및 신규 계좌 이체 차단 조치 완료)."
                  value={resolutionSummary}
                />
              </div>

              <button
                className="j-btn-primary"
                disabled={isSaving || (decision === "CONFIRMED_FRAUD" && !confirmedFraudType.trim())}
                onClick={() => void handleReviewSave()}
                type="button"
              >
                {isSaving ? "저장 중..." : "최종 판정 저장 및 처리 완료"}
              </button>

              {saveMessage && <div className="j-feedback-msg success">{saveMessage}</div>}
              {saveError && <div className="j-feedback-msg danger">{saveError}</div>}
            </div>
          </div>
        </article>
      </section>
      </section>

      {isGuideDetailsOpen && responsePlan && (
        <div
          className="j-guide-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsGuideDetailsOpen(false);
          }}
        >
          <section aria-labelledby="guide-modal-title" aria-modal="true" className="j-guide-modal" role="dialog">
            <header>
              <div>
                <span className="j-section-tag">AGENT RESPONSE PLAN</span>
                <h2 id="guide-modal-title">대응 가이드 전체 절차</h2>
              </div>
              <button aria-label="대응 가이드 닫기" onClick={() => setIsGuideDetailsOpen(false)} type="button">×</button>
            </header>
            <div className="j-guide-modal-body">
              <section className="j-guide-overview">
                <span>{translateRule(responsePlan.applied_fraud_type ?? "데이터 없음")}</span>
                <p>{responsePlan.summary ?? "대응 계획 요약이 없습니다."}</p>
              </section>
              <ol className="j-guide-action-details">
                {recommendedActions.map((action) => (
                  <li key={action.action_code}>
                    <header>
                      <span>{action.priority}단계</span>
                      <strong>{action.action}</strong>
                      {action.required && <em>필수</em>}
                    </header>
                    <p className="j-guide-action-reason">{action.reason}</p>
                    <div className="j-guide-detail-columns">
                      <section>
                        <h3>수행 절차</h3>
                        <ol>
                          {action.procedure_steps.map((step) => <li key={step}>{step}</li>)}
                        </ol>
                      </section>
                      <section className="cautions">
                        <h3>주의 사항</h3>
                        <ul>
                          {action.cautions.map((caution) => <li key={caution}>{caution}</li>)}
                        </ul>
                      </section>
                    </div>
                  </li>
                ))}
              </ol>
              <section className="j-guide-checklist-modal">
                <h3>필수 점검 항목</h3>
                <ul>{checklist.map((checkItem) => <li key={checkItem.item_code}>{checkItem.label}</li>)}</ul>
              </section>
            </div>
          </section>
        </div>
      )}

      {/* 우측 슬라이드 드로어: 채팅 분석 및 상담 소통 이력 */}
      {isChatOpen && (
        <aside className="j-drawer-overlay" aria-label="채팅 분석 및 상담 소통 이력">
          <header className="j-drawer-header">
            <div>
              <span className="j-section-tag">CASE CHAT ANALYSIS</span>
              <h2>채팅 분석 및 상담 소통 이력</h2>
            </div>
            <div className="j-drawer-tools">
              {chat && <span className="j-status-pill">{chat.status}</span>}
              <button aria-label="패널 닫기" className="j-drawer-close" onClick={() => setIsChatOpen(false)} type="button">×</button>
            </div>
          </header>

          <div className="j-drawer-body">
            {chat && chat.messages.length > 0 ? (
              <>
                {(chat.type_scores ?? []).length > 0 && (
                  <section className="j-chat-type-card">
                    <h3>채팅 기반 사기 유형 점수</h3>
                    <div className="j-type-chips-grid">
                      {[...(chat.type_scores ?? [])]
                        .sort((left, right) => right.score - left.score)
                        .map((typeScore) => (
                          <div className="j-type-chip" key={typeScore.type_code}>
                            <span className="j-type-name">{typeScore.display_name}</span>
                            <strong className="j-type-score">{typeScore.score.toFixed(2)}</strong>
                          </div>
                        ))}
                    </div>
                  </section>
                )}

                <div className="j-chat-timeline">
                  <div className="j-timeline-head">
                    <span>실시간 상담 대화 내역 ({chat.messages.length}건)</span>
                  </div>
                  <div className="j-chat-stream">
                    {chat.messages.map((message) => (
                      <article className={`j-bubble ${message.sender_type.toLowerCase()}`} key={message.message_id}>
                        <div className="j-bubble-meta">
                          <strong className="j-bubble-sender">
                            {message.sender_type === "CUSTOMER" ? "고객" : message.sender_type === "AGENT" ? "AI 상담사" : message.sender_type}
                          </strong>
                          <time className="j-bubble-time">{formatDate(message.sent_at)}</time>
                        </div>
                        <p className="j-bubble-text">{message.message_text}</p>
                      </article>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <EmptyData message={detail.chat.error_message ?? "현재 사건과 연동된 고객 상담 채팅 내역이 없습니다."} />
            )}
          </div>
        </aside>
      )}
    </CaseAnalysisPageShell>
  );
}
