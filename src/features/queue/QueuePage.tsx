import { useMemo, useState } from "react";

import { AppLayout } from "../../components/layout/AppLayout";
import type { QueueRow } from "./queueApi";
import { useQueue } from "./useQueue";
import "./QueuePage.css";

function fraudType(row: QueueRow) {
  return row.agent?.response_result?.applied_fraud_type
    ?? row.agent?.rule_result.primary_fraud_type
    ?? Object.entries(row.rule_scores ?? {}).sort(([, left], [, right]) => right - left)[0]?.[0]
    ?? "데이터 없음";
}

function status(row: QueueRow) {
  if (row.confirmed_is_fraud === true) return "사기 확정";
  if (row.confirmed_is_fraud === false) return "정상 확정";
  return "미확정";
}

function ScatterChart({ rows }: { rows: QueueRow[] }) {
  const maxScore = Math.max(...rows.map((row) => row.agent?.risk_score ?? (row.predict_proba ?? 0) * 100), 1);
  return <div className="queue-scatter">
    <div className="scatter-scale"><span>100</span><span>50</span><span>0</span></div>
    <div className="scatter-plot">
      {rows.map((row, index) => {
        const score = row.agent?.risk_score ?? (row.predict_proba ?? 0) * 100;
        return <a aria-label={`거래 ${row.transaction_id} 상세`} href={row.agent ? `#case/${row.transaction_id}` : "#queue"} key={row.transaction_id} style={{ left: `${((index + 0.5) / rows.length) * 100}%`, bottom: `${12 + (score / maxScore) * 72}%` }} title={`#${row.transaction_id} · ${Math.round(score)}점`} />;
      })}
    </div>
    <div className="scatter-caption"><span>최신 의심 거래 {rows.length}건 · Agent 위험점수 또는 ML 확률 기준</span><span>시간 →</span></div>
  </div>;
}

export function QueuePage() {
  const { rows, allCount, isLoading, errorMessage } = useQueue();
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"risk" | "latest">("risk");
  const visibleRows = useMemo(() => rows
    .filter((row) => String(row.transaction_id).includes(query.trim()))
    .sort((left, right) => sortBy === "risk"
      ? (right.agent?.risk_score ?? 0) - (left.agent?.risk_score ?? 0)
      : new Date(right.created_at).getTime() - new Date(left.created_at).getTime()), [rows, query, sortBy]);
  const highCount = rows.filter((row) => ["VERY_HIGH", "HIGH"].includes(row.agent?.risk_grade ?? "")).length;

  return <AppLayout activeNav="queue"><section className="queue-content">
    <header className="queue-header"><div><p>CASE QUEUE</p><h1>FDS 이상거래 검색</h1><span>현재 API에서 조회 가능한 의심 거래를 확인합니다.</span></div><div className="queue-live"><i />실시간 데이터 수신</div></header>
    <section className="queue-filter"><div><label>거래 ID 검색<input onChange={(event) => setQuery(event.target.value)} placeholder="예: 1453" value={query} /></label><label>정렬<select onChange={(event) => setSortBy(event.target.value as "risk" | "latest")} value={sortBy}><option value="risk">위험점수 높은 순</option><option value="latest">최신순</option></select></label></div><p>기간·고객·IP·계좌·금액 필터는 현재 목록 API가 지원하지 않습니다.</p></section>
    <section className="queue-summary"><div><span>전체 거래</span><strong>{allCount.toLocaleString()}건</strong></div><div><span>표시 중인 의심 거래</span><strong>{rows.length}건</strong></div><div><span>HIGH 이상</span><strong>{highCount}건</strong></div><div><span>거래 금액</span><strong>데이터 없음</strong></div></section>
    {isLoading ? <div className="queue-state">처리 목록을 불러오는 중...</div> : errorMessage ? <div className="queue-state">오류: {errorMessage}</div> : <>
      <section className="queue-panel scatter-panel"><div className="queue-panel-head"><div><p>RISK DISTRIBUTION</p><h2>최근 의심 거래 위험도 분포</h2></div><span>점 클릭 시 상세 이동</span></div><ScatterChart rows={visibleRows} /></section>
      <section className="queue-panel queue-table-panel"><div className="queue-panel-head"><div><p>CASE LIST</p><h2>이상거래 검색 결과</h2></div><span>{visibleRows.length}건</span></div><div className="queue-table-wrap"><table><thead><tr><th>순위</th><th>거래 ID</th><th>생성 시각</th><th>ML 확률</th><th>위험등급</th><th>위험점수</th><th>예상 사기유형</th><th>상태</th><th /></tr></thead><tbody>{visibleRows.map((row, index) => <tr key={row.transaction_id}><td>{index + 1}</td><td>TX-{row.transaction_id}</td><td>{new Date(row.created_at).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</td><td>{row.predict_proba === null ? "데이터 없음" : `${(row.predict_proba * 100).toFixed(1)}%`}</td><td><span className={`grade ${row.agent?.risk_grade?.toLowerCase() ?? "empty"}`}>{row.agent?.risk_grade ?? "데이터 없음"}</span></td><td>{row.agent?.risk_score ?? "데이터 없음"}</td><td>{fraudType(row)}</td><td>{status(row)}</td><td>{row.agent ? <a className="queue-detail" href={`#case/${row.transaction_id}`}>보기</a> : <span className="queue-unavailable">없음</span>}</td></tr>)}</tbody></table>{visibleRows.length === 0 && <div className="queue-empty">표시할 의심 거래가 없습니다.</div>}</div></section>
    </>}
  </section></AppLayout>;
}
