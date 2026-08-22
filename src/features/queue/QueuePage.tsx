import { type FormEvent, useMemo, useState } from "react";

import { CaseAnalysisPageShell } from "../caseAnalysis/CaseAnalysisPageShell";
import { formatCompactMoney } from "../dashboard/dashboardFormatters";
import {
  buildRealtimeRiskPoints,
  RealtimeRiskTrendChart,
} from "../dashboard/components/HighRiskTrendPanel";
import type { CaseListItem, QueueSearchFilters } from "./queueTypes";
import { useQueue } from "./useQueue";
import "./QueuePage.css";

const SELECTED_TRANSACTION_ID_KEY = "fds.selectedTransactionId";
const PAGE_SIZE = 16;
const EMPTY_FILTERS: Omit<QueueSearchFilters, "page"> = {
  transactionId: "",
  ipAddress: "",
  riskGrades: [],
  reviewStatuses: [],
  periodStart: "",
  periodEnd: "",
};

const RISK_GRADE_OPTIONS = ["VERY_HIGH", "HIGH", "MEDIUM", "LOW"];
const REVIEW_STATUS_OPTIONS = [
  ["COMPLETED", "처리 완료"],
  ["NEEDS_ACTION", "처리 필요"],
] as const;

function getInitialFilters(): Omit<QueueSearchFilters, "page"> {
  const query = new URLSearchParams(window.location.hash.split("?")[1]);
  const riskGrades = (query.get("risk_grades") ?? "")
    .split(",")
    .filter((riskGrade) => RISK_GRADE_OPTIONS.includes(riskGrade));

  return { ...EMPTY_FILTERS, riskGrades };
}

function selectTransaction(transactionId: number) {
  sessionStorage.setItem(SELECTED_TRANSACTION_ID_KEY, String(transactionId));
}

function caseLink(transactionId: number) {
  return `#case?transaction_id=${transactionId}`;
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

function reviewStatus(value: string) {
  if (value === "COMPLETED") return "처리 완료";
  if (value === "PROCESSING") return "분석 중";
  if (value === "PENDING") return "미처리";
  return "데이터 없음";
}

function fraudTypeLabel(value: string | null, executionStatus: string) {
  if (!value) return executionStatus === "COMPLETED" ? "분석 결과 없음" : "분석 중";

  const labels: Record<string, string> = {
    VOICE_PHISHING: "보이스피싱",
    ACCOUNT_TAKEOVER: "계정 탈취",
    FRAUD_USED_ACCOUNT: "사기 이용 계좌",
    MESSENGER_PHISHING: "메신저피싱",
    UNCLASSIFIED: "유형 미분류",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function QueueRealtimeTrendSection({ rows }: { rows: CaseListItem[] }) {
  const [timeInterval, setTimeInterval] = useState<"second" | "minute">("second");

  const items = useMemo(
    () => buildRealtimeRiskPoints(rows, timeInterval),
    [rows, timeInterval],
  );

  const peakAmount = useMemo(() => Math.max(...items.map((i) => i.amount), 0), [items]);
  const avgScore = useMemo(
    () => (items.length > 0 ? Math.round(items.reduce((s, i) => s + i.score, 0) / items.length) : 0),
    [items],
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="queue-panel scatter-panel realtime-risk-panel">
      <div className="queue-panel-head">
        <div>
          <p>REALTIME RISK MONITORING</p>
          <h2>실시간 위험 거래 반영 현황</h2>
          <span className="queue-panel-sub-desc">서버 수신 시각 기준 위험 거래의 금액(원) 및 위험 점수(Score) 추이 · 점 클릭 시 상세 분석 이동</span>
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

          <span className="live-status-tag"><i className="live-green-dot" /> 실시간 모니터링</span>
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
      <RealtimeRiskTrendChart items={items} height={200} />
    </section>
  );
}

function MobileCaseList({ rows, startIndex }: { rows: CaseListItem[]; startIndex: number }) {
  if (rows.length === 0) {
    return <div className="queue-mobile-list"><div className="queue-empty">검색 조건에 맞는 의심 거래가 없습니다.</div></div>;
  }

  return <div className="queue-mobile-list">
    {rows.map((row, index) => <article className="queue-mobile-card" key={row.transaction_id}>
      <header>
        <div><span>#{startIndex + index}</span><strong>TX-{row.transaction_id}</strong></div>
        <span className={`grade ${row.risk_grade?.toLowerCase() ?? "empty"}`}>{row.risk_grade ?? "데이터 없음"}</span>
      </header>
      <dl>
        <div className="wide"><dt>거래 시각</dt><dd>{formatDateTime(row.transaction_datetime)}</dd></div>
        <div><dt>거래 금액</dt><dd>{row.transaction_amount.toLocaleString()}원</dd></div>
        <div><dt>위험점수</dt><dd>{row.risk_score ?? "데이터 없음"}</dd></div>
        <div className="wide"><dt>IP</dt><dd>{row.ip_address ?? "데이터 없음"}</dd></div>
        <div><dt>예상 사기유형</dt><dd>{fraudTypeLabel(row.primary_fraud_type, row.execution_status)}</dd></div>
        <div><dt>상태</dt><dd>{reviewStatus(row.review_status)}</dd></div>
      </dl>
      <div className="queue-mobile-actions">
        <a className="queue-mobile-detail" href={caseLink(row.transaction_id)} onClick={() => selectTransaction(row.transaction_id)}>상세 분석</a>
      </div>
    </article>)}
  </div>;
}

function CaseTableSection({
  items,
  startNumber,
  emptyMessage,
}: {
  items: CaseListItem[];
  startNumber: number;
  emptyMessage?: string;
}) {
  return <div className="queue-table-column">
    <table>
      <thead>
        <tr>
          <th>번호</th>
          <th>거래 ID</th>
          <th>거래 시각</th>
          <th>IP</th>
          <th>거래 금액</th>
          <th>위험등급</th>
          <th>위험점수</th>
          <th>예상 사기유형</th>
          <th>상태</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {items.map((row, index) => (
          <tr key={row.transaction_id}>
            <td>{startNumber + index}</td>
            <td>TX-{row.transaction_id}</td>
            <td>{formatDateTime(row.transaction_datetime)}</td>
            <td>{row.ip_address ?? "데이터 없음"}</td>
            <td>{row.transaction_amount.toLocaleString()}원</td>
            <td><span className={`grade ${row.risk_grade?.toLowerCase() ?? "empty"}`}>{row.risk_grade ?? "데이터 없음"}</span></td>
            <td>{row.risk_score ?? "데이터 없음"}</td>
            <td>{fraudTypeLabel(row.primary_fraud_type, row.execution_status)}</td>
            <td>{reviewStatus(row.review_status)}</td>
            <td>
              <div className="queue-detail-actions">
                <a className="queue-detail" href={caseLink(row.transaction_id)} onClick={() => selectTransaction(row.transaction_id)}>보기</a>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    {items.length === 0 && emptyMessage && <div className="queue-empty">{emptyMessage}</div>}
  </div>;
}

export function QueuePage() {
  const [draftFilters, setDraftFilters] = useState(getInitialFilters);
  const [filters, setFilters] = useState<QueueSearchFilters>(() => ({ ...getInitialFilters(), page: 1 }));
  const pageSize = PAGE_SIZE;
  const { rows, trendRows, totalCount, isLoading, errorMessage } = useQueue(filters, pageSize);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const highCount = rows.filter((row) => ["VERY_HIGH", "HIGH"].includes(row.risk_grade ?? "")).length;
  const pageAmount = rows.reduce((sum, row) => sum + row.transaction_amount, 0);
  const splitIndex = Math.ceil(rows.length / 2);
  const leftRows = rows.slice(0, splitIndex);
  const rightRows = rows.slice(splitIndex);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters({ ...draftFilters, page: 1 });
  }

  function resetSearch() {
    setDraftFilters(EMPTY_FILTERS);
    setFilters({ ...EMPTY_FILTERS, page: 1 });
  }

  function toggleRiskGrade(riskGrade: string) {
    setDraftFilters((current) => ({
      ...current,
      riskGrades: current.riskGrades.includes(riskGrade)
        ? current.riskGrades.filter((grade) => grade !== riskGrade)
        : [...current.riskGrades, riskGrade],
    }));
  }

  function toggleReviewStatus(reviewStatus: string) {
    setDraftFilters((current) => ({
      ...current,
      reviewStatuses: current.reviewStatuses.includes(reviewStatus)
        ? current.reviewStatuses.filter((status) => status !== reviewStatus)
        : [...current.reviewStatuses, reviewStatus],
    }));
  }

  function movePage(page: number) {
    setFilters((current) => ({ ...current, page }));
  }

  return <CaseAnalysisPageShell activeSection="search" contentClassName="queue-content" headerClassName="queue-header">
    <form className="queue-filter" onSubmit={submitSearch}>
      <label>거래 ID<input min="1" onChange={(event) => setDraftFilters((current) => ({ ...current, transactionId: event.target.value }))} placeholder="예: 1453" type="number" value={draftFilters.transactionId} /></label>
      <label>IP 주소<input onChange={(event) => setDraftFilters((current) => ({ ...current, ipAddress: event.target.value }))} placeholder="예: 203.0.113.10" value={draftFilters.ipAddress} /></label>
      <fieldset className="queue-risk-grade-filter">
        <legend>위험 등급</legend>
        <div>
          {RISK_GRADE_OPTIONS.map((riskGrade) => (
            <label key={riskGrade}>
              <input
                checked={draftFilters.riskGrades.includes(riskGrade)}
                onChange={() => toggleRiskGrade(riskGrade)}
                type="checkbox"
              />
              {riskGrade.replace("_", " ")}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="queue-risk-grade-filter queue-review-status-filter">
        <legend>처리 상태</legend>
        <div>
          {REVIEW_STATUS_OPTIONS.map(([reviewStatus, label]) => (
            <label key={reviewStatus}>
              <input
                checked={draftFilters.reviewStatuses.includes(reviewStatus)}
                onChange={() => toggleReviewStatus(reviewStatus)}
                type="checkbox"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <label>시작 시각<input onChange={(event) => setDraftFilters((current) => ({ ...current, periodStart: event.target.value }))} step="1" type="datetime-local" value={draftFilters.periodStart} /></label>
      <label>종료 시각<input onChange={(event) => setDraftFilters((current) => ({ ...current, periodEnd: event.target.value }))} step="1" type="datetime-local" value={draftFilters.periodEnd} /></label>
      <div className="queue-filter-actions"><button type="button" onClick={resetSearch}>초기화</button><button type="submit">검색</button></div>
    </form>
    <section className="queue-summary"><div><span>검색 결과</span><strong>{totalCount.toLocaleString()}건</strong></div><div><span>현재 페이지</span><strong>{rows.length}건</strong></div><div><span>현재 페이지 HIGH 이상</span><strong>{highCount}건</strong></div><div><span>현재 페이지 거래 금액</span><strong>{pageAmount.toLocaleString()}원</strong></div></section>
    {isLoading ? <div className="queue-state">처리 목록을 불러오는 중...</div> : errorMessage ? <div className="queue-state">오류: {errorMessage}</div> : <>
      <section className="queue-workspace-grid">
        <QueueRealtimeTrendSection rows={trendRows.length > 0 ? trendRows : rows} />
        <section className="queue-panel queue-table-panel">
          <div className="queue-panel-head"><div><p>CASE LIST</p><h2>우선 처리 거래</h2><span className="queue-panel-sub-desc">위험등급과 발생 시각을 따라 연속으로 검토합니다</span></div><span>{totalCount}건</span></div>
          <div className="queue-dual-table-wrap">
            <CaseTableSection
              emptyMessage={rows.length === 0 ? "검색 조건에 맞는 의심 거래가 없습니다." : undefined}
              items={leftRows}
              startNumber={(filters.page - 1) * pageSize + 1}
            />
            <CaseTableSection
              items={rightRows}
              startNumber={(filters.page - 1) * pageSize + splitIndex + 1}
            />
          </div>
          <MobileCaseList rows={rows} startIndex={(filters.page - 1) * pageSize + 1} />
          <nav aria-label="처리 목록 페이지" className="queue-pagination"><button disabled={filters.page === 1} onClick={() => movePage(filters.page - 1)} type="button">이전</button><span>{filters.page} / {totalPages}</span><button disabled={filters.page >= totalPages} onClick={() => movePage(filters.page + 1)} type="button">다음</button></nav>
        </section>
      </section>
    </>}
  </CaseAnalysisPageShell>;
}
