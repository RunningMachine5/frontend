import { useEffect, useMemo, useState } from "react";

import { AppLayout } from "../../components/layout/AppLayout";
import { PageHeading } from "../../components/layout/PageHeading";
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
  severe_amount_context: "고액 거래 정황",
  recipient_transfer_with_severe_amount: "고액 수취계좌 이체",
  new_recipient: "신규 수취인",
  remote_control: "원격제어 정황",
  unused_account: "장기 미사용 계좌",
  unused_terminal: "장기 미사용 단말",
  high_amount: "고액 거래",
};

const DECISION_LABELS: Record<ReviewDecision, string> = {
  CONFIRMED_FRAUD: "사기 확정",
  FALSE_POSITIVE: "정상 거래",
  ON_HOLD: "판정 보류",
};

function getTransactionId() {
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
          contribution: 0,
        })),
      );

  if (entries.length === 0) return <EmptyData message="적중한 Rule 근거가 없습니다." />;

  return (
    <ul className="evidence-list">
      {entries.slice(0, 4).map((evidence) => (
        <li key={`${evidence.fraud_type}-${evidence.evidence_code}`}>
          <strong className="evidence-code">{translateRule(evidence.fraud_type)}</strong>
          <span>{translateRule(evidence.evidence_code)} · +{evidence.contribution.toFixed(2)}</span>
        </li>
      ))}
    </ul>
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
  const [openWing, setOpenWing] = useState<"chat" | "review" | null>(null);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [performedActions, setPerformedActions] = useState<Set<string>>(new Set());
  const [decision, setDecision] = useState<ReviewDecision>("ON_HOLD");
  const [confirmedFraudType, setConfirmedFraudType] = useState("");
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

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
    setCheckedItems(new Set(
      (review?.checklist_results ?? [])
        .filter((item) => item.checked ?? item.cheked ?? false)
        .map((item) => item.item_code),
    ));
    setPerformedActions(new Set(
      (review?.performed_actions ?? [])
        .filter((item) => item.performed)
        .map((item) => item.action_code),
    ));
  }, [detail]);

  if (transactionId === null) {
    return <AppLayout activeNav="case"><main className="case-state">처리 페이지에서 분석할 거래를 먼저 선택해주세요.</main></AppLayout>;
  }
  if (isLoading) return <AppLayout activeNav="case"><main className="case-state">사건 상세 정보를 불러오는 중...</main></AppLayout>;
  if (errorMessage || !detail) {
    return <AppLayout activeNav="case"><main className="case-state">오류: {errorMessage ?? "표시할 사건 데이터가 없습니다."}</main></AppLayout>;
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
  const similarCases = agent?.similar_case_results ?? [];
  const responsePlan = agent?.response_result;
  const checklist = responsePlan?.checklist ?? [];
  const recommendedActions = responsePlan?.recommended_actions ?? [];
  const chat = detail.chat.data;
  const review = detail.review.data;
  const riskGrade = agent?.risk_grade ?? "데이터 없음";
  const investigationReason = typeof agent?.investigation_result?.recommendation_reason === "string"
    ? agent.investigation_result.recommendation_reason
    : "추가 조사 결과가 없습니다.";

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
      performed_actions: recommendedActions.map((item) => ({
        action_code: item.action_code,
        performed: performedActions.has(item.action_code),
      })),
      checklist_results: checklist.map((item) => ({
        item_code: item.item_code,
        checked: checkedItems.has(item.item_code),
      })),
      resolution_summary: resolutionSummary.trim() || null,
    };

    setSaveMessage(null);
    try {
      await saveReview(caseId, request);
      setSaveMessage("최종 판정이 저장되었습니다.");
    } catch {
      setSaveMessage(null);
    }
  }

  return (
    <AppLayout activeNav="case">
      <section className="case-content">
        <header className="app-page-header case-header">
          <PageHeading eyebrow="CASE INVESTIGATION" title="FDS 이상거래 분석" />
        </header>

        <section className="case-hero">
          <div><span className="case-label">CASE ID</span><strong>{detail.case_id}</strong><span className="case-transaction">거래 #{detail.transaction_id}</span></div>
          <div className={`risk-chip ${riskClass(agent?.risk_grade ?? null)}`}><span>위험등급</span><strong>{riskGrade}</strong><em>{agent?.risk_score ?? "—"}점</em></div>
          <div><span className="case-label">예상 사기유형</span><strong>{translateRule(responsePlan?.applied_fraud_type ?? ruleResult?.primary_fraud_type ?? "데이터 없음")}</strong></div>
          <div><span className="case-label">AGENT 상태</span><strong>{agent?.execution_status ?? detail.case_agent.status}</strong></div>
        </section>

        <section className="case-main-grid">
          <article className="case-panel risk-card">
            <div className="case-panel-head"><div><p className="case-eyebrow">RISK ASSESSMENT</p><h2>우선순위 및 위험도</h2></div><span className={`dot ${riskClass(agent?.risk_grade ?? null)}`} /></div>
            {agent ? <><div className="risk-score-content"><strong>{agent.risk_score ?? "—"}</strong><div><b>{riskGrade}</b><p>Agent가 Rule 결과를 바탕으로 산정한 위험도입니다.</p></div></div><p className="investigation-note">{investigationReason}</p></> : <EmptyData message={detail.case_agent.error_message ?? "Agent 사건 분석 결과가 없습니다."} />}
          </article>

          <article className="case-panel analysis-card">
            <div className="analysis-section">
              <div className="case-panel-head"><div><p className="case-eyebrow">ML PREDICTION</p><h2>ML 점수</h2></div><span className="data-source">통합 상세 API</span></div>
              {ml ? <><div className="ml-score"><strong>{formatPercent(ml.fraud_probability)}</strong><span>{ml.is_fraud === true ? "의심 거래 예측" : ml.is_fraud === false ? "정상 거래 예측" : "예측 결과 없음"}</span></div><dl className="mini-definition"><div><dt>예측 상태</dt><dd>{ml.prediction_status}</dd></div><div><dt>모델</dt><dd>{ml.model_version ?? "데이터 없음"}</dd></div></dl></> : <EmptyData message={detail.ml.error_message ?? "ML 예측 결과가 없습니다."} />}
            </div>
            <div className="analysis-section rule-summary">
              <div className="case-panel-head"><div><p className="case-eyebrow">RULE ENGINE</p><h2>Rule 적용 근거</h2></div><span>{Object.keys(ruleResult?.matched_components ?? {}).length}개</span></div>
              {typeScores.length > 0 ? <div className="type-score-list">{typeScores.map(([type, score]) => <div key={type}><span title={type}>{translateRule(type)}</span><i><b style={{ width: `${(score / maxTypeScore) * 100}%` }} /></i><strong>{score.toFixed(2)}</strong></div>)}</div> : <EmptyData message="Rule 유형별 점수가 없습니다." />}
              <RuleEvidenceList components={ruleResult?.matched_components} />
            </div>
          </article>

          <article className="case-panel similar-card">
            <div className="case-panel-head"><div><p className="case-eyebrow">SIMILAR CASES</p><h2>유사 사례 Top 3</h2></div><span>{similarCases.length}건</span></div>
            {similarCases.length > 0 ? <div className="similar-list">{similarCases.slice(0, 3).map((item) => <div className="similar-row" key={item.similar_case_id}><b>#{item.similarity_rank}</b><div><strong>{item.similar_case_id}</strong><p>{item.similarity_reason}</p></div><span>{formatPercent(item.similarity_score)}</span></div>)}</div> : <EmptyData message="조건에 맞는 완료 사건이 없습니다." />}
          </article>

          <article className="case-panel"><div className="case-panel-head"><div><p className="case-eyebrow">TRANSACTION PROFILE</p><h2>거래 · 고객 · 계좌 정보</h2></div></div>{transaction ? <dl className="profile-definition"><div><dt>거래 시각</dt><dd>{formatDate(transaction.transaction_datetime)}</dd></div><div><dt>거래 금액</dt><dd>{formatAmount(transaction.transaction_amount)}</dd></div><div><dt>채널 / 위치</dt><dd>{transaction.channel} / {formatLocation(transaction)}</dd></div><div><dt>고객 ID</dt><dd>{transaction.customer_id ?? "데이터 없음"}</dd></div><div><dt>출금 계좌</dt><dd>{transaction.source_account_number}</dd></div><div><dt>수취 계좌</dt><dd>{transaction.recipient_account_number}</dd></div></dl> : <EmptyData message={detail.transaction.error_message ?? "거래 정보가 없습니다."} />}</article>
          <article className="case-panel"><div className="case-panel-head"><div><p className="case-eyebrow">DEVICE SIGNAL</p><h2>단말 · 접속 위험정보</h2></div></div><DeviceRiskInfo transaction={transaction} /></article>

          <article className="case-panel guide-checklist-card">
            <div className="guide-section"><div className="case-panel-head"><div><p className="case-eyebrow">AGENT RESPONSE PLAN</p><h2>대응 가이드</h2></div><span className="data-source">Agent 결과</span></div>{responsePlan ? <><p className="guide-summary">{responsePlan.summary ?? "요약 데이터 없음"}</p><ol className="action-list">{recommendedActions.map((item) => <li key={item.action_code}><b>{item.priority}</b><div><strong>{item.action}</strong><p>{item.reason}</p></div></li>)}</ol></> : <EmptyData message="Agent 대응 가이드가 생성되지 않았습니다." />}</div>
            <div className="checklist-section"><div className="case-panel-head"><div><p className="case-eyebrow">REVIEW CHECKLIST</p><h2>체크리스트</h2></div><span>{checkedItems.size}/{checklist.length} 완료</span></div>{checklist.length > 0 ? <ul className="checklist">{checklist.map((item) => <li className={checkedItems.has(item.item_code) ? "checked" : ""} key={item.item_code}><label><input checked={checkedItems.has(item.item_code)} onChange={() => toggleSet(setCheckedItems, item.item_code)} type="checkbox" /><span>{item.label}</span></label>{item.required && <em>필수</em>}</li>)}</ul> : <EmptyData message="Agent 체크리스트가 없습니다." />}</div>
          </article>
        </section>
      </section>

      <div className="case-wing-rail" aria-label="사건 보조 패널">
        <button className={openWing === "chat" ? "case-wing-tab active" : "case-wing-tab"} onClick={() => setOpenWing(openWing === "chat" ? null : "chat")} type="button">사건 소통</button>
        <button className={openWing === "review" ? "case-wing-tab active" : "case-wing-tab"} onClick={() => setOpenWing(openWing === "review" ? null : "review")} type="button">최종 판정</button>
      </div>

      {openWing && (
        <aside className="case-wing-drawer" aria-label={openWing === "chat" ? "사건 소통 및 처리 이력" : "최종 판정 및 처리"}>
          <header><div><p className="case-eyebrow">{openWing === "chat" ? "CASE ACTIVITY" : "REVIEW ACTION"}</p><h2>{openWing === "chat" ? "사건 소통 및 처리 이력" : "최종 판정 및 처리"}</h2></div><button aria-label="패널 닫기" onClick={() => setOpenWing(null)} type="button">×</button></header>
          {openWing === "chat" ? (
            chat && chat.messages.length > 0 ? <div className="chat-history"><div className="chat-session-status"><span>세션 상태</span><strong>{chat.status}</strong></div>{(chat.type_scores ?? []).length > 0 && <section className="chat-type-scores"><span>채팅 기반 사기 유형</span>{[...(chat.type_scores ?? [])].sort((left, right) => right.score - left.score).map((typeScore) => <div key={typeScore.type_code}><strong>{typeScore.display_name}</strong><em>{typeScore.score.toFixed(2)}</em></div>)}</section>}{chat.messages.map((message) => <article className={`chat-entry ${message.sender_type.toLowerCase()}`} key={message.message_id}><div><strong>{message.sender_type === "CUSTOMER" ? "고객" : message.sender_type === "AGENT" ? "AI" : message.sender_type}</strong><time>{formatDate(message.sent_at)}</time></div><p>{message.message_text}</p></article>)}</div> : <EmptyData message={detail.chat.error_message ?? "연결된 채팅 메시지가 없습니다."} />
          ) : (
            <div className="review-form">
              {review && <p className="saved-review">최근 저장: {formatDate(review.reviewed_at)}</p>}
              <label>최종 판정<select onChange={(event) => setDecision(event.target.value as ReviewDecision)} value={decision}>{Object.entries(DECISION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              {decision === "CONFIRMED_FRAUD" && <label>확정 사기유형<input onChange={(event) => setConfirmedFraudType(event.target.value)} placeholder="예: VOICE_PHISHING" value={confirmedFraudType} /></label>}
              {recommendedActions.length > 0 && <fieldset><legend>수행 조치</legend>{recommendedActions.map((item) => <label className="review-check" key={item.action_code}><input checked={performedActions.has(item.action_code)} onChange={() => toggleSet(setPerformedActions, item.action_code)} type="checkbox" /><span>{item.action}</span></label>)}</fieldset>}
              <label>처리 근거<textarea onChange={(event) => setResolutionSummary(event.target.value)} placeholder="최종 판정 근거를 입력하세요." value={resolutionSummary} /></label>
              <button className="review-save" disabled={isSaving || (decision === "CONFIRMED_FRAUD" && !confirmedFraudType.trim())} onClick={() => void handleReviewSave()} type="button">{isSaving ? "저장 중..." : "최종 판정 저장"}</button>
              {saveMessage && <small className="save-success">{saveMessage}</small>}
              {saveError && <small className="save-error">{saveError}</small>}
            </div>
          )}
        </aside>
      )}
    </AppLayout>
  );
}
