import { useMemo, useState } from "react";

import { AppLayout } from "../../components/layout/AppLayout";
import type { RuleEvidence } from "./caseDetailTypes";
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

function formatScore(value: number) {
  return `${Math.round(value * 100)}점`;
}

function formatEvidenceValue(value: unknown) {
  if (typeof value === "boolean") return value ? "탐지됨" : "미탐지";
  if (typeof value === "object" && value !== null) return "상세 근거 확인";
  return String(value);
}

function riskClass(grade: string) {
  if (grade === "VERY_HIGH") return "very-high";
  if (grade === "HIGH") return "high";
  if (grade === "MEDIUM") return "medium";
  return "low";
}

function EmptyData({ message = "현재 연동된 데이터가 없습니다." }: { message?: string }) {
  return <div className="case-empty"><span>—</span><p>데이터 없음</p><small>{message}</small></div>;
}

function RuleEvidenceList({ evidence }: { evidence: RuleEvidence[] }) {
  if (evidence.length === 0) return <EmptyData message="적중한 Rule 근거가 없습니다." />;

  return (
    <ul className="evidence-list">
      {evidence.map((item, index) => (
        <li key={`${item.evidence_code}-${index}`}>
          <span className="evidence-code">{item.evidence_code.replaceAll("_", " ")}</span>
          <span>{formatEvidenceValue(item.observed_value)}</span>
          <strong>+{formatScore(item.contribution)}</strong>
        </li>
      ))}
    </ul>
  );
}

export function CaseDetailPage() {
  const transactionId = useMemo(getTransactionId, []);
  const { transaction, agent, isLoading, errorMessage } = useCaseDetail(transactionId);
  const [openWing, setOpenWing] = useState<"chat" | "review" | null>(null);

  if (isLoading) return <main className="case-state">사건 상세 정보를 불러오는 중...</main>;
  if (errorMessage || !transaction || !agent) {
    return <main className="case-state">오류: {errorMessage ?? "표시할 사건 데이터가 없습니다."}</main>;
  }

  const typeScores = Object.entries(agent.rule_result.type_scores)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 4);
  const maxTypeScore = Math.max(...typeScores.map(([, score]) => score), 0.01);
  const hasSimilarCases = agent.similar_case_results.length > 0;

  return (
    <AppLayout activeNav="case">
      <section className="case-content">
        <header className="case-header">
          <div><p className="case-eyebrow">CASE INVESTIGATION</p><h1>FDS 이상거래 분석</h1></div>
        </header>

        <section className="case-hero">
          <div><span className="case-label">CASE ID</span><strong>{agent.case_id}</strong><span className="case-transaction">거래 #{transaction.transaction_id}</span></div>
          <div className={`risk-chip ${riskClass(agent.risk_grade)}`}><span>위험등급</span><strong>{agent.risk_grade}</strong><em>{agent.risk_score}점</em></div>
          <div><span className="case-label">예상 사기유형</span><strong>{agent.response_result?.applied_fraud_type ?? agent.rule_result.primary_fraud_type ?? "데이터 없음"}</strong></div>
          <div><span className="case-label">AGENT 상태</span><strong>{agent.execution_status}</strong></div>
        </section>

        <section className="case-main-grid">
          <article className="case-panel risk-card">
            <div className="case-panel-head"><div><p className="case-eyebrow">RISK ASSESSMENT</p><h2>우선순위 및 위험도</h2></div><span className={`dot ${riskClass(agent.risk_grade)}`} /></div>
            <div className="risk-score-content"><strong>{agent.risk_score}</strong><div><b>{agent.risk_grade}</b><p>Agent가 Rule 결과를 바탕으로 산정한 위험도입니다.</p></div></div>
            <p className="investigation-note">{agent.investigation_result?.recommendation_reason ?? "추가 조사 결과가 없습니다."}</p>
          </article>

          <article className="case-panel analysis-card">
            <div className="analysis-section">
              <div className="case-panel-head"><div><p className="case-eyebrow">ML PREDICTION</p><h2>ML 점수</h2></div><span className="data-source">/transactions</span></div>
              <div className="ml-score"><strong>{formatPercent(transaction.predict_proba)}</strong><span>{transaction.predict_result === true ? "의심 거래 예측" : transaction.predict_result === false ? "정상 거래 예측" : "예측 결과 없음"}</span></div>
              <dl className="mini-definition"><div><dt>예측 상태</dt><dd>{transaction.prediction_status}</dd></div><div><dt>Rule Set</dt><dd>{transaction.rule_set_id ?? "데이터 없음"}</dd></div></dl>
            </div>
            <div className="analysis-section rule-summary">
              <div className="case-panel-head"><div><p className="case-eyebrow">RULE ENGINE</p><h2>Rule 적용 근거</h2></div><span>{agent.rule_result.matched_components.length}개</span></div>
              <div className="type-score-list">
                {typeScores.map(([type, score]) => <div key={type}><span>{type}</span><i><b style={{ width: `${(score / maxTypeScore) * 100}%` }} /></i><strong>{score.toFixed(2)}</strong></div>)}
              </div>
              <RuleEvidenceList evidence={agent.rule_result.matched_components.slice(0, 2)} />
            </div>
          </article>

          <article className="case-panel similar-card"><div className="case-panel-head"><div><p className="case-eyebrow">SIMILAR CASES</p><h2>유사 사례 Top 3</h2></div><span>{hasSimilarCases ? `${agent.similar_case_results.length}건` : "0건"}</span></div>{hasSimilarCases ? <div className="similar-list">{agent.similar_case_results.map((item) => <div className="similar-row" key={item.similar_case_id}><b>#{item.similarity_rank}</b><div><strong>{item.similar_case_id}</strong><p>{item.similarity_reason}</p></div><span>{formatPercent(item.similarity_score)}</span></div>)}</div> : <EmptyData message="조건에 맞는 완료 사건이 없습니다." />}</article>

          <article className="case-panel unavailable-card"><div className="case-panel-head"><div><p className="case-eyebrow">TRANSACTION PROFILE</p><h2>거래 · 고객 · 계좌 정보</h2></div></div><EmptyData message="현재 거래 상세 조회 API에 제공되지 않는 항목입니다." /></article>
          <article className="case-panel unavailable-card"><div className="case-panel-head"><div><p className="case-eyebrow">DEVICE SIGNAL</p><h2>단말 · 접속 위험정보</h2></div></div><EmptyData message="현재 거래 상세 조회 API에 제공되지 않는 항목입니다." /></article>

          <article className="case-panel guide-checklist-card">
            <div className="guide-section"><div className="case-panel-head"><div><p className="case-eyebrow">AGENT RESPONSE PLAN</p><h2>대응 가이드</h2></div><span className="data-source">Agent 결과</span></div>{agent.response_result ? <><p className="guide-summary">{agent.response_result.summary}</p><ol className="action-list">{agent.response_result.recommended_actions.map((item) => <li key={item.action_code}><b>{item.priority}</b><div><strong>{item.action}</strong><p>{item.reason}</p></div></li>)}</ol></> : <EmptyData message="Agent 대응 가이드가 생성되지 않았습니다." />}</div>
            <div className="checklist-section"><div className="case-panel-head"><div><p className="case-eyebrow">REVIEW CHECKLIST</p><h2>체크리스트</h2></div><span>상태 미연동</span></div>{agent.response_result ? <ul className="checklist">{agent.response_result.checklist.map((item) => <li key={item.item_code}><i /><span>{item.label}</span>{item.required && <em>필수</em>}</li>)}</ul> : <EmptyData />}</div>
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
            <EmptyData message="채팅 및 처리 이력 API가 연결되면 이곳에 표시됩니다." />
          ) : (
            <div className="review-form">
              <p>처리 결과 저장 API가 준비되면 담당자 판정과 근거를 저장할 수 있습니다.</p>
              <label>최종 판정<select disabled defaultValue=""><option value="">판정 선택</option></select></label>
              <label>처리 근거<textarea disabled placeholder="처리 근거 입력" /></label>
              <div><button disabled type="button">거래 보류</button><button disabled type="button">처리 완료</button></div>
              <small>저장 기능 준비 중</small>
            </div>
          )}
        </aside>
      )}
    </AppLayout>
  );
}
