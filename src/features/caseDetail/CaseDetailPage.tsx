import { useMemo, useState } from "react";

import { AppLayout } from "../../components/layout/AppLayout";
import { useCaseDetail } from "./useCaseDetail";
import "./CaseDetailPage.css";
import "./CaseDetailPageResponsive.css";

const DEFAULT_TRANSACTION_ID = 1453;

function getTransactionId() {
  const match = window.location.hash.match(/^#case\/(\d+)$/);
  return match ? Number(match[1]) : DEFAULT_TRANSACTION_ID;
}

function formatPercent(value: number | null) {
  return value === null ? "데이터 없음" : `${(value * 100).toFixed(1)}%`;
}

function formatAmount(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
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

function RuleEvidenceList({ components }: { components?: Record<string, string[]> }) {
  const entries = Object.entries(components ?? {}).filter(([, values]) => values.length > 0);

  if (entries.length === 0) return <EmptyData message="적중한 Rule 근거가 없습니다." />;

  return (
    <ul className="evidence-list">
      {entries.slice(0, 3).map(([fraudType, values]) => (
        <li key={fraudType}>
          <span className="evidence-code">{fraudType.replaceAll("_", " ")}</span>
          <span>{values.join(", ")}</span>
        </li>
      ))}
    </ul>
  );
}

export function CaseDetailPage() {
  const transactionId = useMemo(getTransactionId, []);
  const { detail, isLoading, errorMessage } = useCaseDetail(transactionId);
  const [openWing, setOpenWing] = useState<"chat" | "review" | null>(null);

  if (isLoading) return <main className="case-state">사건 상세 정보를 불러오는 중...</main>;
  if (errorMessage || !detail) {
    return <main className="case-state">오류: {errorMessage ?? "표시할 사건 데이터가 없습니다."}</main>;
  }

  const transaction = detail.transaction.data;
  const ml = detail.ml.data;
  const agent = detail.case_agent.data;
  const ruleResult = agent?.rule_result;
  const typeScores = Object.entries(ruleResult?.type_scores ?? {})
    .sort(([, left], [, right]) => right - left)
    .slice(0, 4);
  const maxTypeScore = Math.max(...typeScores.map(([, score]) => score), 0.01);
  const hasSimilarCases = (agent?.similar_case_results.length ?? 0) > 0;
  const responsePlan = agent?.response_result;
  const chat = detail.chat.data;
  const review = detail.review.data;
  const riskGrade = agent?.risk_grade ?? "데이터 없음";

  return (
    <AppLayout activeNav="case">
      <section className="case-content">
        <header className="case-header">
          <div><p className="case-eyebrow">CASE INVESTIGATION</p><h1>FDS 이상거래 분석</h1></div>
        </header>

        <section className="case-hero">
          <div><span className="case-label">CASE ID</span><strong>{detail.case_id}</strong><span className="case-transaction">거래 #{detail.transaction_id}</span></div>
          <div className={`risk-chip ${riskClass(agent?.risk_grade ?? null)}`}><span>위험등급</span><strong>{riskGrade}</strong><em>{agent?.risk_score ?? "—"}점</em></div>
          <div><span className="case-label">예상 사기유형</span><strong>{responsePlan?.applied_fraud_type ?? ruleResult?.primary_fraud_type ?? "데이터 없음"}</strong></div>
          <div><span className="case-label">AGENT 상태</span><strong>{agent?.execution_status ?? detail.case_agent.status}</strong></div>
        </section>

        <section className="case-main-grid">
          <article className="case-panel risk-card">
            <div className="case-panel-head"><div><p className="case-eyebrow">RISK ASSESSMENT</p><h2>우선순위 및 위험도</h2></div><span className={`dot ${riskClass(agent?.risk_grade ?? null)}`} /></div>
            {agent ? <><div className="risk-score-content"><strong>{agent.risk_score ?? "—"}</strong><div><b>{riskGrade}</b><p>Agent가 Rule 결과를 바탕으로 산정한 위험도입니다.</p></div></div><p className="investigation-note">{agent.failure_reason ?? "추가 조사 결과가 없습니다."}</p></> : <EmptyData message={detail.case_agent.error_message ?? "Agent 사건 분석 결과가 없습니다."} />}
          </article>

          <article className="case-panel analysis-card">
            <div className="analysis-section">
              <div className="case-panel-head"><div><p className="case-eyebrow">ML PREDICTION</p><h2>ML 점수</h2></div><span className="data-source">통합 상세 API</span></div>
              {ml ? <><div className="ml-score"><strong>{formatPercent(ml.fraud_probability)}</strong><span>{ml.is_fraud === true ? "의심 거래 예측" : ml.is_fraud === false ? "정상 거래 예측" : "예측 결과 없음"}</span></div><dl className="mini-definition"><div><dt>예측 상태</dt><dd>{ml.prediction_status}</dd></div><div><dt>모델</dt><dd>{ml.model_version ?? "데이터 없음"}</dd></div></dl></> : <EmptyData message={detail.ml.error_message ?? "ML 예측 결과가 없습니다."} />}
            </div>
            <div className="analysis-section rule-summary">
              <div className="case-panel-head"><div><p className="case-eyebrow">RULE ENGINE</p><h2>Rule 적용 근거</h2></div><span>{Object.keys(ruleResult?.matched_components ?? {}).length}개</span></div>
              {typeScores.length > 0 ? <div className="type-score-list">{typeScores.map(([type, score]) => <div key={type}><span>{type}</span><i><b style={{ width: `${(score / maxTypeScore) * 100}%` }} /></i><strong>{score.toFixed(2)}</strong></div>)}</div> : <EmptyData message="Rule 유형별 점수가 없습니다." />}
              <RuleEvidenceList components={ruleResult?.matched_components} />
            </div>
          </article>

          <article className="case-panel similar-card"><div className="case-panel-head"><div><p className="case-eyebrow">SIMILAR CASES</p><h2>유사 사례 Top 3</h2></div><span>{hasSimilarCases ? `${agent?.similar_case_results.length}건` : "0건"}</span></div>{hasSimilarCases ? <div className="similar-list">{agent?.similar_case_results.map((item) => <div className="similar-row" key={item.similar_case_id}><b>#{item.similarity_rank}</b><div><strong>{item.similar_case_id}</strong><p>{item.similarity_reason}</p></div><span>{formatPercent(item.similarity_score)}</span></div>)}</div> : <EmptyData message="조건에 맞는 완료 사건이 없습니다." />}</article>

          <article className="case-panel unavailable-card"><div className="case-panel-head"><div><p className="case-eyebrow">TRANSACTION PROFILE</p><h2>거래 · 고객 · 계좌 정보</h2></div></div>{transaction ? <dl className="mini-definition"><div><dt>거래 시각</dt><dd>{new Date(transaction.transaction_datetime).toLocaleString("ko-KR")}</dd></div><div><dt>거래 금액</dt><dd>{formatAmount(transaction.transaction_amount)}</dd></div><div><dt>채널 / 위치</dt><dd>{transaction.channel} / {transaction.location}</dd></div><div><dt>고객 ID</dt><dd>{transaction.customer_id}</dd></div><div><dt>출금 계좌</dt><dd>{transaction.source_account_id}</dd></div><div><dt>수취 계좌</dt><dd>{transaction.recipient_account_id ?? "데이터 없음"}</dd></div></dl> : <EmptyData message={detail.transaction.error_message ?? "거래 정보가 없습니다."} />}</article>
          <article className="case-panel unavailable-card"><div className="case-panel-head"><div><p className="case-eyebrow">DEVICE SIGNAL</p><h2>단말 · 접속 위험정보</h2></div></div><EmptyData message="현재 통합 상세 API에 단말·접속 정보가 제공되지 않습니다." /></article>

          <article className="case-panel guide-checklist-card">
            <div className="guide-section"><div className="case-panel-head"><div><p className="case-eyebrow">AGENT RESPONSE PLAN</p><h2>대응 가이드</h2></div><span className="data-source">Agent 결과</span></div>{responsePlan ? <><p className="guide-summary">{responsePlan.summary ?? "요약 데이터 없음"}</p><ol className="action-list">{(responsePlan.recommended_actions ?? []).map((item) => <li key={item.action_code}><b>{item.priority}</b><div><strong>{item.action}</strong><p>{item.reason}</p></div></li>)}</ol></> : <EmptyData message="Agent 대응 가이드가 생성되지 않았습니다." />}</div>
            <div className="checklist-section"><div className="case-panel-head"><div><p className="case-eyebrow">REVIEW CHECKLIST</p><h2>체크리스트</h2></div><span>상태 미연동</span></div>{responsePlan ? <ul className="checklist">{(responsePlan.checklist ?? []).map((item) => <li key={item.item_code}><i /><span>{item.label}</span>{item.required && <em>필수</em>}</li>)}</ul> : <EmptyData />}</div>
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
            chat && chat.messages.length > 0 ? <div className="similar-list">{chat.messages.map((message) => <div className="similar-row" key={message.message_id}><b>{message.sender_type}</b><div><strong>{new Date(message.sent_at).toLocaleString("ko-KR")}</strong><p>{message.message_text}</p></div></div>)}</div> : <EmptyData message={detail.chat.error_message ?? "연결된 채팅 메시지가 없습니다."} />
          ) : review ? (
            <div className="review-form"><p>저장된 최종 검토 결과입니다.</p><p>판정: {String(review.decision ?? "데이터 없음")}</p><p>처리 요약: {String(review.resolution_summary ?? "데이터 없음")}</p><small>수정·저장 API는 준비 중입니다.</small></div>
          ) : (
            <div className="review-form"><p>{detail.review.error_message ?? "저장된 최종 판정 데이터가 없습니다."}</p><small>수정·저장 API는 준비 중입니다.</small></div>
          )}
        </aside>
      )}
    </AppLayout>
  );
}
