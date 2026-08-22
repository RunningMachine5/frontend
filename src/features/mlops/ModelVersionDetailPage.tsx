// 한 모델의 학습 성능과 실제 처리 거래를 분리해 비교한다.

import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { AdminAlert } from "../admin/AdminAlert";
import { ModelLoadError } from "./components/ModelLoadError";
import { ModelLoadingStatus } from "./components/ModelLoadingStatus";
import { ModelPageShell } from "./components/ModelPageShell";
import {
  COMPARISON_METRICS,
  formatDate,
  hasEnoughLabelSample,
  labelCoveragePercent,
  metric,
  metricText,
  STATUS_LABELS,
} from "./modelOperations";
import {
  fetchModelDetails,
  fetchModelTransactions,
  fetchModelVersions,
  reactivateModel,
} from "./mlopsApi";
import type {
  ModelDetails,
  ModelTransactionPage,
  ModelVersionSummary,
} from "./mlopsTypes";

const numberFormat = new Intl.NumberFormat("ko-KR");
const amountFormat = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" });

type LabelFilter = "ALL" | "LABELED" | "MISMATCH";

function labelText(value: boolean | null) {
  if (value === null) return "미판정";
  return value ? "사기" : "정상";
}

export function ModelVersionDetailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { runId: runIdParam } = useParams();
  const runId = Number(runIdParam);
  const [model, setModel] = useState<ModelVersionSummary | null>(null);
  const [details, setDetails] = useState<ModelDetails | null>(null);
  const [transactions, setTransactions] = useState<ModelTransactionPage | null>(null);
  const [labelFilter, setLabelFilter] = useState<LabelFilter>("ALL");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true);
  const [isReactivating, setIsReactivating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [transactionsAttempt, setTransactionsAttempt] = useState(0);
  const catalogSearch = (location.state as { catalogSearch?: string } | null)?.catalogSearch ?? "";

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError(null);
    setModel(null);
    setDetails(null);
    void Promise.all([
      fetchModelVersions(loadAttempt > 0),
      fetchModelDetails(runId),
    ])
      .then(([models, modelDetails]) => {
        if (!active) return;
        const selected = models.find((item) => item.training_run_id === runId) ?? null;
        if (!selected) throw new Error("저장된 모델을 찾지 못했습니다.");
        setModel(selected);
        setDetails(modelDetails);
      })
      .catch((cause) => {
        if (!active) return;
        setLoadError(cause instanceof Error ? cause.message : "모델 정보를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, [loadAttempt, runId]);

  useEffect(() => {
    let active = true;
    setIsTransactionsLoading(true);
    setTransactionsError(null);
    void fetchModelTransactions(runId, labelFilter, page)
      .then((response) => {
        if (!active) return;
        setTransactions(response);
      })
      .catch((cause) => {
        if (!active) return;
        setTransactionsError(cause instanceof Error ? cause.message : "처리 거래를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setIsTransactionsLoading(false);
      });
    return () => { active = false; };
  }, [labelFilter, page, runId, transactionsAttempt]);

  const pageCount = Math.max(1, Math.ceil((transactions?.total_count ?? 0) / (transactions?.page_size ?? 10)));
  const offlineMetrics = useMemo(() => COMPARISON_METRICS.map((item) => ({
    label: item.label,
    value: metric(details, ...item.keys),
  })), [details]);
  const labelCoverage = model ? labelCoveragePercent(model.usage) : null;
  const hasLabelSample = model ? hasEnoughLabelSample(model.usage) : false;

  const reactivate = async () => {
    if (!model) return;
    const confirmed = window.confirm(
      `model v${model.model_version}을 운영 반영 후보로 다시 준비할까요?\n현재 운영 모델과 트래픽은 그대로 유지됩니다.`,
    );
    if (!confirmed) return;

    setIsReactivating(true);
    setActionError(null);
    try {
      await reactivateModel(model.training_run_id);
      navigate(`/models/runs/${model.training_run_id}`);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "모델을 다시 준비하지 못했습니다.");
      setIsReactivating(false);
    }
  };

  return (
    <ModelPageShell
      activeSection="versions"
      actions={(
        <>
          {model?.status === "RETIRED" && (
            <button
              className="admin-button primary"
              disabled={isReactivating}
              onClick={() => void reactivate()}
              type="button"
            >
              {isReactivating ? "준비 요청 중…" : "운영 반영 준비"}
            </button>
          )}
          <Link className="admin-button" to={`/models/versions${catalogSearch}`}>모델 목록으로</Link>
        </>
      )}
    >
      {actionError && <AdminAlert message={actionError} onDismiss={() => setActionError(null)} tone="error" />}
      {isLoading ? (
        <ModelLoadingStatus
          description="학습 성능과 실제 처리 이력을 함께 확인하고 있습니다."
          label="MODEL DETAILS"
          title="모델 상세 정보를 불러오고 있습니다"
        />
      ) : loadError || !model || !details ? (
        <ModelLoadError
          description={loadError ?? "모델 정보를 확인할 수 없습니다."}
          label="MODEL DETAILS"
          onRetry={() => setLoadAttempt((current) => current + 1)}
          title="모델 상세 정보를 불러오지 못했습니다"
        />
      ) : (
        <section className="model-version-detail">
          <header className="admin-panel model-version-hero">
            <div className="model-version-hero-title">
              <div>
                <p className="admin-eyebrow">MODEL VERSION</p>
                <h2>model v{model.model_version}</h2>
                {model.status === "RETIRED" && (
                  <p className="model-reactivate-note">
                    현재 운영 모델은 유지하고, 검증용 0% 후보부터 다시 준비합니다.
                  </p>
                )}
              </div>
              <em className={`status ${model.status.toLowerCase()}`}>
                {STATUS_LABELS[model.status] ?? model.status}
              </em>
            </div>
            <dl>
              <div><dt>학습 Run</dt><dd>#{model.training_run_id}</dd></div>
              <div><dt>학습 데이터셋</dt><dd title={model.dataset_version}>{model.dataset_version}</dd></div>
              <div><dt>학습 요청 시각</dt><dd>{formatDate(model.created_at)}</dd></div>
              <div><dt>실제 처리</dt><dd>{model.usage.processed_transaction_count > 0 ? `${numberFormat.format(model.usage.processed_transaction_count)}건` : "처리 기록 없음"}</dd></div>
            </dl>
          </header>

          <section className="model-version-evidence-grid">
            <article className="admin-panel model-version-offline">
              <header className="panel-title">
                <p className="admin-eyebrow">OFFLINE EVALUATION</p>
                <h2>학습 성능</h2>
                <small>학습 시 검증 데이터로 계산한 지표입니다.</small>
              </header>
              <dl>
                {offlineMetrics.map((item) => (
                  <div key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>{metricText(item.value)}</dd>
                  </div>
                ))}
              </dl>
            </article>

            <article className="admin-panel model-version-online">
              <header className="panel-title">
                <p className="admin-eyebrow">OPERATION EVIDENCE</p>
                <h2>실제 처리 결과</h2>
                <small>운영 요청과 담당자 확정 라벨을 기준으로 확인합니다.</small>
              </header>
              <dl>
                <div className="primary">
                  <dt>라벨 일치율</dt>
                  <dd>{model.usage.label_agreement_percent === null ? "—" : `${model.usage.label_agreement_percent.toFixed(1)}%`}</dd>
                  <small className={!hasLabelSample && model.usage.labeled_transaction_count > 0 ? "model-label-sample low" : undefined}>
                    {model.usage.labeled_transaction_count === 0
                      ? "확정 라벨 없음"
                      : `${hasLabelSample ? "" : "표본 적음 · "}확정 라벨 ${numberFormat.format(model.usage.labeled_transaction_count)}건 · 적용률 ${labelCoverage?.toFixed(1)}%`}
                  </small>
                </div>
                <div><dt>사기 예측</dt><dd>{numberFormat.format(model.usage.fraud_prediction_count)}건</dd></div>
                <div><dt>정상을 사기로 예측</dt><dd>{numberFormat.format(model.usage.false_positive_count)}건</dd></div>
                <div><dt>사기를 정상으로 예측</dt><dd>{numberFormat.format(model.usage.false_negative_count)}건</dd></div>
                <div><dt>평균 응답</dt><dd>{model.usage.average_latency_ms === null ? "—" : `${numberFormat.format(model.usage.average_latency_ms)}ms`}</dd></div>
              </dl>
              <p className="model-version-period">
                처리 기간 · {model.usage.first_inference_at ? formatDate(model.usage.first_inference_at) : "기록 없음"}
                {model.usage.latest_inference_at ? ` ~ ${formatDate(model.usage.latest_inference_at)}` : ""}
              </p>
            </article>
          </section>

          <section className="admin-panel model-version-transactions">
            <header className="panel-title split">
              <div>
                <p className="admin-eyebrow">TRANSACTION HISTORY</p>
                <h2>이 모델이 처리한 거래</h2>
                <small>담당자 판정이 있는 거래는 예측 결과와 나란히 비교합니다.</small>
              </div>
              <div aria-label="거래 라벨 필터" className="model-transaction-filters" role="group">
                <button
                  aria-pressed={labelFilter === "ALL"}
                  className={labelFilter === "ALL" ? "active" : undefined}
                  onClick={() => { setLabelFilter("ALL"); setPage(1); }}
                  type="button"
                >
                  전체
                </button>
                <button
                  aria-pressed={labelFilter === "LABELED"}
                  className={labelFilter === "LABELED" ? "active" : undefined}
                  onClick={() => { setLabelFilter("LABELED"); setPage(1); }}
                  type="button"
                >
                  라벨 있음
                </button>
                <button
                  aria-pressed={labelFilter === "MISMATCH"}
                  className={labelFilter === "MISMATCH" ? "active" : undefined}
                  onClick={() => { setLabelFilter("MISMATCH"); setPage(1); }}
                  type="button"
                >
                  불일치만
                </button>
              </div>
            </header>
            <div className={`model-transaction-table-wrap ${isTransactionsLoading ? "loading" : ""}`}>
              {transactionsError ? (
                <div className="model-catalog-empty">
                  <strong>처리 거래를 불러오지 못했습니다.</strong>
                  <span>{transactionsError}</span>
                  <button className="admin-button" onClick={() => setTransactionsAttempt((current) => current + 1)} type="button">다시 불러오기</button>
                </div>
              ) : <table className="model-transaction-table">
                <thead>
                  <tr>
                    <th>거래 ID</th>
                    <th>거래 시각</th>
                    <th>채널</th>
                    <th>거래 금액</th>
                    <th>모델 예측</th>
                    <th>사기 확률</th>
                    <th>담당자 판정</th>
                    <th>비교</th>
                    <th>상세</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions?.items.map((transaction) => (
                    <tr key={transaction.transaction_id}>
                      <td data-label="거래 ID"><strong>TX-{transaction.transaction_id}</strong></td>
                      <td data-label="거래 시각">{formatDate(transaction.transaction_datetime)}</td>
                      <td data-label="채널">{transaction.channel}</td>
                      <td data-label="거래 금액">{amountFormat.format(transaction.transaction_amount)}</td>
                      <td data-label="모델 예측"><em className={`model-result ${transaction.predict_result ? "fraud" : "normal"}`}>{labelText(transaction.predict_result)}</em></td>
                      <td data-label="사기 확률">{(transaction.predict_proba * 100).toFixed(1)}%</td>
                      <td data-label="담당자 판정">{labelText(transaction.confirmed_is_fraud)}</td>
                      <td data-label="비교">
                        <em className={`model-label-match ${transaction.label_matches === null ? "pending" : transaction.label_matches ? "match" : "mismatch"}`}>
                          {transaction.label_matches === null ? "비교 전" : transaction.label_matches ? "일치" : "불일치"}
                        </em>
                      </td>
                      <td data-label="상세"><a className="model-catalog-open" href={`/#case?transaction_id=${transaction.transaction_id}`}>보기 →</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>}
              {!transactionsError && !isTransactionsLoading && transactions?.items.length === 0 && (
                <div className="model-catalog-empty">
                  <strong>{model.usage.processed_transaction_count > 0 ? "조건에 맞는 거래가 없습니다." : "처리 기록이 없습니다."}</strong>
                  <span>{model.usage.processed_transaction_count > 0 ? "다른 비교 조건을 선택해보세요." : "이 모델이 추론 요청을 처리하면 여기에 기록됩니다."}</span>
                </div>
              )}
            </div>
            <footer className="model-catalog-pagination">
              <span>총 {numberFormat.format(transactions?.total_count ?? 0)}건</span>
              <div>
                <button disabled={page === 1 || isTransactionsLoading} onClick={() => setPage(page - 1)} type="button">이전</button>
                <strong>{page} / {pageCount}</strong>
                <button disabled={page === pageCount || isTransactionsLoading} onClick={() => setPage(page + 1)} type="button">다음</button>
              </div>
            </footer>
          </section>
        </section>
      )}
    </ModelPageShell>
  );
}
