import { type FormEvent, useEffect, useMemo, useState } from "react";

import { LiveStatus } from "../../components/layout/LiveStatus";
import { CaseAnalysisPageShell } from "../caseAnalysis/CaseAnalysisPageShell";
import type { CaseListItem, QueueSearchFilters } from "./queueTypes";
import { useQueue } from "./useQueue";
import "./QueuePage.css";

const SELECTED_TRANSACTION_ID_KEY = "fds.selectedTransactionId";
const WINDOWED_PAGE_SIZE = 5;
const FULLSCREEN_PAGE_SIZE = 10;
const FULLSCREEN_HEIGHT = 1000;
const EMPTY_FILTERS = {
  transactionId: "",
  ipAddress: "",
  periodStart: "",
  periodEnd: "",
};

function getPageSize() {
  return window.innerHeight >= FULLSCREEN_HEIGHT ? FULLSCREEN_PAGE_SIZE : WINDOWED_PAGE_SIZE;
}

function useResponsivePageSize() {
  const [pageSize, setPageSize] = useState(getPageSize);

  useEffect(() => {
    function updatePageSize() {
      setPageSize(getPageSize());
    }

    window.addEventListener("resize", updatePageSize);
    return () => window.removeEventListener("resize", updatePageSize);
  }, []);

  return pageSize;
}

function selectTransaction(transactionId: number) {
  sessionStorage.setItem(SELECTED_TRANSACTION_ID_KEY, String(transactionId));
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatAxisTime(value: string | number) {
  return new Date(value).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function reviewStatus(value: string) {
  if (value === "COMPLETED") return "처리 완료";
  if (value === "PROCESSING") return "분석 중";
  if (value === "PENDING") return "미처리";
  return "데이터 없음";
}

function ScatterChart({ rows }: { rows: CaseListItem[] }) {
  const timeRows = useMemo(
    () => [...rows].sort((left, right) => new Date(left.transaction_datetime).getTime() - new Date(right.transaction_datetime).getTime()),
    [rows],
  );
  const times = timeRows.map((row) => new Date(row.transaction_datetime).getTime());
  const minTime = times[0] ?? 0;
  const maxTime = times[times.length - 1] ?? minTime;
  const middleTime = minTime + (maxTime - minTime) / 2;

  return <div className="queue-scatter">
    <div className="scatter-scale"><span>100</span><span>50</span><span>0</span></div>
    <div className="scatter-plot">
      {timeRows.map((row, index) => {
        const score = Math.max(0, Math.min(100, row.risk_score ?? 0));
        const rawPosition = maxTime === minTime ? (index + 1) / (timeRows.length + 1) : (times[index] - minTime) / (maxTime - minTime);
        return <a
          aria-label={`거래 ${row.transaction_id} 상세`}
          href="#case"
          key={row.transaction_id}
          onClick={() => selectTransaction(row.transaction_id)}
          style={{ left: `${4 + rawPosition * 92}%`, bottom: `${score}%` }}
          title={`TX-${row.transaction_id} · ${score}점 · ${formatAxisTime(row.transaction_datetime)}`}
        />;
      })}
    </div>
    <div className="scatter-time-axis">
      {timeRows.length > 0
        ? <><span>{formatAxisTime(minTime)}</span><span>{formatAxisTime(middleTime)}</span><span>{formatAxisTime(maxTime)}</span></>
        : <span>조회 결과 없음</span>}
    </div>
    <div className="scatter-caption"><span>현재 페이지 위험점수 분포</span><span>거래 시각(시:분:초) →</span></div>
  </div>;
}

export function QueuePage() {
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState<QueueSearchFilters>({ ...EMPTY_FILTERS, page: 1 });
  const pageSize = useResponsivePageSize();
  const { rows, totalCount, isLoading, errorMessage } = useQueue(filters, pageSize);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const highCount = rows.filter((row) => ["VERY_HIGH", "HIGH"].includes(row.risk_grade ?? "")).length;
  const pageAmount = rows.reduce((sum, row) => sum + row.transaction_amount, 0);

  useEffect(() => {
    setFilters((current) => current.page === 1 ? current : { ...current, page: 1 });
  }, [pageSize]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters({ ...draftFilters, page: 1 });
  }

  function resetSearch() {
    setDraftFilters(EMPTY_FILTERS);
    setFilters({ ...EMPTY_FILTERS, page: 1 });
  }

  function movePage(page: number) {
    setFilters((current) => ({ ...current, page }));
  }

  return <CaseAnalysisPageShell activeSection="search" actions={<LiveStatus label="실시간 데이터 수신" />} contentClassName="queue-content" headerClassName="queue-header">
    <form className="queue-filter" onSubmit={submitSearch}>
      <label>거래 ID<input min="1" onChange={(event) => setDraftFilters((current) => ({ ...current, transactionId: event.target.value }))} placeholder="예: 1453" type="number" value={draftFilters.transactionId} /></label>
      <label>IP 주소<input onChange={(event) => setDraftFilters((current) => ({ ...current, ipAddress: event.target.value }))} placeholder="예: 203.0.113.10" value={draftFilters.ipAddress} /></label>
      <label>시작 시각<input onChange={(event) => setDraftFilters((current) => ({ ...current, periodStart: event.target.value }))} step="1" type="datetime-local" value={draftFilters.periodStart} /></label>
      <label>종료 시각<input onChange={(event) => setDraftFilters((current) => ({ ...current, periodEnd: event.target.value }))} step="1" type="datetime-local" value={draftFilters.periodEnd} /></label>
      <div className="queue-filter-actions"><button type="button" onClick={resetSearch}>초기화</button><button type="submit">검색</button></div>
    </form>
    <section className="queue-summary"><div><span>검색 결과</span><strong>{totalCount.toLocaleString()}건</strong></div><div><span>현재 페이지</span><strong>{rows.length}건</strong></div><div><span>현재 페이지 HIGH 이상</span><strong>{highCount}건</strong></div><div><span>현재 페이지 거래 금액</span><strong>{pageAmount.toLocaleString()}원</strong></div></section>
    {isLoading ? <div className="queue-state">처리 목록을 불러오는 중...</div> : errorMessage ? <div className="queue-state">오류: {errorMessage}</div> : <>
      <section className="queue-panel scatter-panel"><div className="queue-panel-head"><div><p>RISK DISTRIBUTION</p><h2>최근 의심 거래 위험도 분포</h2></div><span>점 클릭 시 상세 이동</span></div><ScatterChart rows={rows} /></section>
      <section className="queue-panel queue-table-panel"><div className="queue-panel-head"><div><p>CASE LIST</p><h2>이상거래 검색 결과</h2></div><span>{totalCount}건</span></div><div className="queue-table-wrap"><table><thead><tr><th>순위</th><th>거래 ID</th><th>거래 시각</th><th>IP</th><th>거래 금액</th><th>위험등급</th><th>위험점수</th><th>예상 사기유형</th><th>상태</th><th /></tr></thead><tbody>{rows.map((row, index) => <tr key={row.transaction_id}><td>{(filters.page - 1) * pageSize + index + 1}</td><td>TX-{row.transaction_id}</td><td>{formatDateTime(row.transaction_datetime)}</td><td>{row.ip_address ?? "데이터 없음"}</td><td>{row.transaction_amount.toLocaleString()}원</td><td><span className={`grade ${row.risk_grade?.toLowerCase() ?? "empty"}`}>{row.risk_grade ?? "데이터 없음"}</span></td><td>{row.risk_score ?? "데이터 없음"}</td><td>{row.primary_fraud_type ?? "데이터 없음"}</td><td>{reviewStatus(row.review_status)}</td><td><a className="queue-detail" href="#case" onClick={() => selectTransaction(row.transaction_id)}>보기</a></td></tr>)}</tbody></table>{rows.length === 0 && <div className="queue-empty">검색 조건에 맞는 의심 거래가 없습니다.</div>}</div>
        <nav aria-label="처리 목록 페이지" className="queue-pagination"><button disabled={filters.page === 1} onClick={() => movePage(filters.page - 1)} type="button">이전</button><span>{filters.page} / {totalPages}</span><button disabled={filters.page >= totalPages} onClick={() => movePage(filters.page + 1)} type="button">다음</button></nav>
      </section>
    </>}
  </CaseAnalysisPageShell>;
}
