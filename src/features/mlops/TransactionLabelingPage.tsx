import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { ModelPageShell } from "./components/ModelPageShell";
import { ModelLoadingStatus } from "./components/ModelLoadingStatus";
import {
  clearTransactionLabel,
  fetchTransactionLabelQueue,
  saveTransactionLabel,
} from "./transactionLabelingApi";
import type {
  TransactionLabelQueueItem,
  TransactionLabelQueueResponse,
  TransactionLabelStatus,
  TransactionPredictionFilter,
} from "./transactionLabelingTypes";

const PAGE_SIZE = 8;
const numberFormat = new Intl.NumberFormat("ko-KR");
const dateTimeFormat = new Intl.DateTimeFormat("ko-KR", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const labelFilters: Array<{
  id: TransactionLabelStatus;
  label: string;
  count: "total_count" | "unlabeled_count" | "normal_count" | "fraud_count";
}> = [
  { id: "ALL", label: "전체 거래", count: "total_count" },
  { id: "UNLABELED", label: "미판정", count: "unlabeled_count" },
  { id: "NORMAL", label: "정상 확정", count: "normal_count" },
  { id: "FRAUD", label: "사기 확정", count: "fraud_count" },
];

function formatDateTime(value: string) {
  return dateTimeFormat.format(new Date(value));
}

function formatMoney(value: number | null) {
  return value === null ? "—" : `${numberFormat.format(value)}원`;
}

function probabilityText(value: number | null) {
  return value === null ? "확률 없음" : `${Math.round(value * 100)}%`;
}

function labelText(value: boolean | null) {
  if (value === true) return "사기 확정";
  if (value === false) return "정상 확정";
  return "미판정";
}

function labelClass(value: boolean | null) {
  if (value === true) return "fraud";
  if (value === false) return "normal";
  return "unlabeled";
}

function predictionText(item: TransactionLabelQueueItem) {
  if (item.predict_result === null) return "예측 없음";
  return item.predict_result ? "사기 의심" : "정상 예측";
}

export function TransactionLabelingPage() {
  const [labelStatus, setLabelStatus] = useState<TransactionLabelStatus>("UNLABELED");
  const [prediction, setPrediction] = useState<TransactionPredictionFilter>("ALL");
  const [searchText, setSearchText] = useState("");
  const [transactionId, setTransactionId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [data, setData] = useState<TransactionLabelQueueResponse | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextSelectedId?: number) => {
    setIsLoading(true);
    try {
      const result = await fetchTransactionLabelQueue({
        labelStatus,
        prediction,
        transactionId,
        page,
        pageSize: PAGE_SIZE,
      });
      setData(result);
      setSelectedId((current) => {
        const candidate = nextSelectedId ?? current;
        return result.items.some((item) => item.transaction_id === candidate)
          ? candidate
          : result.items[0]?.transaction_id ?? null;
      });
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "라벨링 거래를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [labelStatus, page, prediction, transactionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => data?.items.find((item) => item.transaction_id === selectedId) ?? null,
    [data?.items, selectedId],
  );
  const totalPages = Math.max(1, Math.ceil((data?.total_count ?? 0) / PAGE_SIZE));

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const moveToPage = (value: string) => {
    const requestedPage = Number(value);
    if (!Number.isInteger(requestedPage)) {
      setPageInput(String(page));
      return;
    }
    const nextPage = Math.min(totalPages, Math.max(1, requestedPage));
    setPageInput(String(nextPage));
    setPage(nextPage);
  };

  const nextTransactionId = () => {
    if (!selected || !data || data.items.length < 2) {
      return undefined;
    }
    const currentIndex = data.items.findIndex(
      (item) => item.transaction_id === selected.transaction_id,
    );
    return data.items[(currentIndex + 1) % data.items.length].transaction_id;
  };

  const moveToNext = () => {
    const nextId = nextTransactionId();
    setNotice(null);
    if (nextId === undefined) {
      setNotice("현재 목록에서 다음 거래가 없습니다.");
      return;
    }
    setSelectedId(nextId);
  };

  const saveLabel = async (confirmedIsFraud: boolean) => {
    if (!selected) return;
    const transaction = selected;
    const nextId = nextTransactionId();
    setIsSaving(true);
    setNotice(null);
    setError(null);
    try {
      await saveTransactionLabel(transaction.transaction_id, confirmedIsFraud);
      setNotice(
        `TX-${transaction.transaction_id}을 ${confirmedIsFraud ? "사기" : "정상"} 거래로 확정했습니다.`,
      );
      // 저장이 성공한 뒤에만 다음 거래로 이동한다.
      await load(nextId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "거래 판정을 저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const clearLabel = async () => {
    if (!selected || selected.confirmed_is_fraud === null) return;
    const transaction = selected;
    setIsSaving(true);
    setNotice(null);
    setError(null);
    try {
      await clearTransactionLabel(transaction.transaction_id);
      setNotice(`TX-${transaction.transaction_id}을 미판정 상태로 되돌렸습니다.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "거래 판정을 지우지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const search = (event: FormEvent) => {
    event.preventDefault();
    const value = searchText.trim();
    setTransactionId(value ? Number(value) : null);
    setPage(1);
  };

  const changeLabelStatus = (next: TransactionLabelStatus) => {
    setLabelStatus(next);
    setPage(1);
    setNotice(null);
  };

  return (
    <ModelPageShell
      activeSection="labeling"
      actions={(
        <button
          className="admin-button compact"
          disabled={isLoading || isSaving}
          onClick={() => void load()}
          type="button"
        >
          {isLoading ? "갱신 중…" : "목록 새로고침"}
        </button>
      )}
    >
      {error && <div className="admin-alert error" role="alert">{error}</div>}
      {notice && <div className="admin-alert success" role="status">{notice}</div>}

      {isLoading && !isSaving && (
        <ModelLoadingStatus
          description="선택한 조건의 거래 목록과 라벨 현황을 함께 조회합니다."
          label="REVIEW QUEUE"
          title="라벨링 거래를 불러오고 있습니다"
        />
      )}

      <section aria-label="거래 라벨 현황" className="labeling-status-strip">
        {labelFilters.map((filter) => (
          <button
            aria-pressed={labelStatus === filter.id}
            className={labelStatus === filter.id ? "active" : undefined}
            key={filter.id}
            onClick={() => changeLabelStatus(filter.id)}
            type="button"
          >
            <span>{filter.label}</span>
            <strong>{data ? numberFormat.format(data.summary[filter.count]) : "—"}</strong>
            {filter.id === "UNLABELED" && <small>검토 필요</small>}
          </button>
        ))}
      </section>

      <section className="labeling-workspace">
        <aside className="admin-panel labeling-queue-panel">
          <div className="panel-title split">
            <div>
              <p className="admin-eyebrow">REVIEW QUEUE</p>
              <h2>거래 목록</h2>
              <small>최신 거래부터 표시합니다.</small>
            </div>
            <strong>{data ? numberFormat.format(data.total_count) : "—"}</strong>
          </div>

          <div className="labeling-filters">
            <form onSubmit={search}>
              <input
                aria-label="거래 ID 검색"
                autoComplete="off"
                inputMode="numeric"
                name="transaction-id"
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="거래 ID 검색…"
                type="search"
                value={searchText}
              />
              <button type="submit">검색</button>
            </form>
            <label>
              <span>ML 예측</span>
              <select
                autoComplete="off"
                name="prediction-filter"
                onChange={(event) => {
                  setPrediction(event.target.value as TransactionPredictionFilter);
                  setPage(1);
                }}
                value={prediction}
              >
                <option value="ALL">전체</option>
                <option value="FRAUD">사기 의심</option>
                <option value="NORMAL">정상 예측</option>
              </select>
            </label>
          </div>

          <div className="labeling-queue-list">
            {isLoading && !data ? (
              <div aria-label="거래 목록을 불러오는 중" className="labeling-list-skeleton">
                {Array.from({ length: PAGE_SIZE }, (_, index) => <i key={index} />)}
              </div>
            ) : data?.items.length ? data.items.map((item) => (
              <button
                aria-pressed={selectedId === item.transaction_id}
                className={selectedId === item.transaction_id ? "selected" : undefined}
                key={item.transaction_id}
                onClick={() => setSelectedId(item.transaction_id)}
                type="button"
              >
                <span className="labeling-row-main">
                  <strong>TX-{item.transaction_id}</strong>
                  <b>{formatMoney(item.transaction_amount)}</b>
                  <small>{formatDateTime(item.transaction_datetime)} · {item.channel}</small>
                </span>
                <span className="labeling-row-state">
                  <em className={`prediction ${item.predict_result ? "fraud" : item.predict_result === false ? "normal" : "empty"}`}>
                    {predictionText(item)} {item.predict_proba !== null && probabilityText(item.predict_proba)}
                  </em>
                  <em className={`label ${labelClass(item.confirmed_is_fraud)}`}>
                    {labelText(item.confirmed_is_fraud)}
                  </em>
                </span>
              </button>
            )) : (
              <div className="labeling-empty-list">
                <strong>조건에 맞는 거래가 없습니다.</strong>
                <span>라벨 상태나 ML 예측 필터를 바꿔보세요.</span>
              </div>
            )}
          </div>

          <footer className="labeling-pagination">
            <button disabled={page <= 1 || isLoading} onClick={() => setPage(page - 1)} type="button">이전</button>
            <form onSubmit={(event) => { event.preventDefault(); moveToPage(pageInput); }}>
              <input
                aria-label="이동할 페이지"
                disabled={isLoading}
                inputMode="numeric"
                max={totalPages}
                min="1"
                onBlur={() => moveToPage(pageInput)}
                onChange={(event) => setPageInput(event.target.value)}
                type="number"
                value={pageInput}
              />
              <span>/ {totalPages}</span>
              <button disabled={isLoading} type="submit">이동</button>
            </form>
            <button disabled={page >= totalPages || isLoading} onClick={() => setPage(page + 1)} type="button">다음</button>
          </footer>
        </aside>

        <article className="admin-panel labeling-review-panel">
          {selected ? (
            <>
              <header className="labeling-detail-header">
                <div>
                  <p className="admin-eyebrow">TRANSACTION REVIEW</p>
                  <h2>TX-{selected.transaction_id}</h2>
                  <span>{formatDateTime(selected.transaction_datetime)} · {selected.channel}</span>
                </div>
                <strong>{formatMoney(selected.transaction_amount)}</strong>
              </header>

              <section aria-label="모델 예측과 담당자 판정" className="labeling-decision-band">
                <div>
                  <span>ML 예측</span>
                  <strong className={selected.predict_result ? "danger" : selected.predict_result === false ? "positive" : ""}>
                    {predictionText(selected)}
                  </strong>
                  <small>
                    {probabilityText(selected.predict_proba)}
                    {selected.model_version ? ` · ${selected.model_version}` : ""}
                  </small>
                </div>
                <div>
                  <span>담당자 확정</span>
                  <strong className={labelClass(selected.confirmed_is_fraud)}>
                    {labelText(selected.confirmed_is_fraud)}
                  </strong>
                  <small aria-live="polite">
                    {isSaving
                      ? "판정 결과 저장 중…"
                      : selected.labeled_at
                        ? `${formatDateTime(selected.labeled_at)} 저장`
                        : "아직 학습 라벨이 없습니다."}
                  </small>
                </div>
              </section>

              <section aria-busy={isSaving} className="labeling-action-row">
                <button
                  aria-pressed={selected.confirmed_is_fraud === false}
                  className="label-action normal"
                  disabled={isSaving}
                  onClick={() => void saveLabel(false)}
                  type="button"
                >
                  정상 거래
                </button>
                <button
                  aria-pressed={selected.confirmed_is_fraud === true}
                  className="label-action fraud"
                  disabled={isSaving}
                  onClick={() => void saveLabel(true)}
                  type="button"
                >
                  사기 확정
                </button>
                <button className="label-action later" disabled={isSaving} onClick={moveToNext} type="button">
                  다음에 확인
                </button>
                <button
                  className="label-action clear"
                  disabled={isSaving || selected.confirmed_is_fraud === null}
                  onClick={() => void clearLabel()}
                  type="button"
                >
                  확정 취소
                </button>
              </section>

              <section className="labeling-detail-section">
                <header><h3>거래 정보</h3><span>{selected.transaction_status === "DECLINED" ? "거절 거래" : "승인 거래"}</span></header>
                <dl className="labeling-detail-grid">
                  <div><dt>고객 ID</dt><dd>{selected.customer_id ?? "—"}</dd></div>
                  <div><dt>출금 계좌</dt><dd>{selected.source_account_number}</dd></div>
                  <div><dt>수취 계좌</dt><dd>{selected.recipient_account_number}</dd></div>
                  <div><dt>거래 후 잔액</dt><dd>{formatMoney(selected.balance)}</dd></div>
                  <div><dt>접속 환경</dt><dd>{selected.operating_system ?? "—"} · {selected.access_medium ?? "매체 없음"}</dd></div>
                  <div><dt>IP 주소</dt><dd>{selected.ip_address ?? "—"}</dd></div>
                </dl>
              </section>

              <section className="labeling-detail-section signal-section">
                <header><h3>접속 위험 신호</h3><span>거래 시점 기준</span></header>
                <ul>
                  <li className={selected.num_connection_failure > 0 ? "detected" : undefined}><span>연결 실패</span><strong>{selected.num_connection_failure}회</strong></li>
                  <li className={selected.vpn_indicator ? "detected" : undefined}><span>VPN</span><strong>{selected.vpn_indicator ? "감지" : "없음"}</strong></li>
                  <li className={selected.rooting_jailbreak_indicator ? "detected" : undefined}><span>루팅·탈옥</span><strong>{selected.rooting_jailbreak_indicator ? "감지" : "없음"}</strong></li>
                  <li className={selected.mobile_roaming_indicator ? "detected" : undefined}><span>로밍</span><strong>{selected.mobile_roaming_indicator ? "감지" : "없음"}</strong></li>
                  <li className={selected.terminal_malicious_behavior_detected ? "detected" : undefined}><span>단말 악성행위</span><strong>{selected.terminal_malicious_behavior_detected ? "감지" : "없음"}</strong></li>
                </ul>
              </section>
            </>
          ) : (
            <div className="labeling-empty-detail">
              <strong>검토할 거래를 선택하세요.</strong>
              <span>왼쪽 목록에서 거래를 선택하면 예측과 거래 정보가 표시됩니다.</span>
            </div>
          )}
        </article>
      </section>
    </ModelPageShell>
  );
}
