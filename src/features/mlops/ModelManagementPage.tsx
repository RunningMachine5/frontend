// 모델 관리의 시작점: 현재 운영 모델과 다음에 처리할 업무만 요약한다.

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";

import { AdminAlert } from "../admin/AdminAlert";
import { ModelPageShell } from "./components/ModelPageShell";
import {
  ACTION_REQUIRED_STATUSES,
  actionLabel,
  formatClock,
  formatDate,
  latestRevisionTraffic,
  resourceName,
  STATUS_LABELS,
} from "./modelOperations";
import {
  fetchDatasets,
  fetchInferencePerformance,
  fetchModelDetails,
  fetchPlatformStatus,
  fetchServingStatus,
  fetchTrainingRuns,
} from "./mlopsApi";
import { fetchTransactionLabelQueue } from "./transactionLabelingApi";
import type {
  DatasetVersion,
  InferencePerformance,
  ModelDetails,
  PlatformStatus,
  ServingStatus,
  TrainingRun,
} from "./mlopsTypes";
import type { TransactionLabelQueueSummary } from "./transactionLabelingTypes";

const OVERVIEW_REFRESH_MS = 15_000;
const numberFormat = new Intl.NumberFormat("ko-KR");
const ACTION_RUNS_PER_PAGE = 4;

interface ModelOverviewSnapshot {
  datasets: DatasetVersion[];
  runs: TrainingRun[];
  serving: ServingStatus | null;
  labelSummary: TransactionLabelQueueSummary | null;
  inference: InferencePerformance | null;
  platform: PlatformStatus | null;
  updatedAt: Date;
}

let overviewCache: ModelOverviewSnapshot | null = null;
let overviewRequest: Promise<ModelOverviewSnapshot> | null = null;
let detailsCache: { runId: number; value: ModelDetails; updatedAt: Date } | null = null;
let detailsRequest: { runId: number; promise: Promise<ModelDetails | null> } | null = null;

function getCachedOverview() {
  if (!overviewCache) return null;
  const age = Date.now() - overviewCache.updatedAt.getTime();
  return age < OVERVIEW_REFRESH_MS ? overviewCache : null;
}

async function fetchOverview(force = false) {
  const cached = getCachedOverview();
  if (!force && cached) return cached;
  if (overviewRequest) return overviewRequest;

  const runsRequest = fetchTrainingRuns();
  overviewRequest = Promise.all([
    fetchDatasets(),
    runsRequest,
    fetchServingStatus().catch(() => null),
    fetchTransactionLabelQueue({
      labelStatus: "ALL",
      prediction: "ALL",
      transactionId: null,
      page: 1,
      pageSize: 1,
    }).then((response) => response.summary).catch(() => null),
    fetchInferencePerformance().catch(() => null),
    fetchPlatformStatus().catch(() => null),
  ]).then(([datasets, runs, serving, labelSummary, inference, platform]) => {
    overviewCache = {
      datasets,
      runs,
      serving,
      labelSummary,
      inference,
      platform,
      updatedAt: new Date(),
    };
    return overviewCache;
  });

  try {
    return await overviewRequest;
  } finally {
    overviewRequest = null;
  }
}

async function fetchProductionDetails(runId: number) {
  if (detailsCache?.runId === runId) {
    const age = Date.now() - detailsCache.updatedAt.getTime();
    if (age < OVERVIEW_REFRESH_MS) return detailsCache.value;
  }
  if (detailsRequest?.runId === runId) return detailsRequest.promise;

  const promise = fetchModelDetails(runId)
    .then((value) => {
      detailsCache = { runId, value, updatedAt: new Date() };
      return value;
    })
    .catch(() => null);
  detailsRequest = { runId, promise };

  try {
    return await promise;
  } finally {
    if (detailsRequest?.promise === promise) detailsRequest = null;
  }
}

function ModelOverviewSkeleton() {
  return (
    <>
      <span className="model-overview-loading-label" role="status">
        모델 운영 정보를 불러오는 중입니다.
      </span>
      <section aria-hidden="true" className="model-command-grid">
        <article className="admin-panel production-command model-overview-skeleton-card model-overview-skeleton-production">
          <i /><i />
          <div className="model-overview-skeleton-facts">
            {Array.from({ length: 4 }, (_, index) => <i key={index} />)}
          </div>
        </article>
        <aside className="admin-panel model-action-inbox model-overview-skeleton-card model-overview-skeleton-inbox">
          <i />
          {Array.from({ length: 5 }, (_, index) => <i key={index} />)}
        </aside>
      </section>
      <section aria-hidden="true" className="model-summary-grid">
        {Array.from({ length: 3 }, (_, index) => (
          <article className="model-overview-skeleton-card model-overview-skeleton-summary" key={index}>
            <i /><i /><i /><i />
          </article>
        ))}
      </section>
    </>
  );
}

export function ModelManagementPage() {
  const [overview, setOverview] = useState<ModelOverviewSnapshot | null>(() => getCachedOverview());
  const [productionDetails, setProductionDetails] = useState<ModelDetails | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(() => overview === null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [actionPage, setActionPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async (force = false) => {
    if (document.visibilityState !== "visible") return null;
    setIsRefreshing(true);
    try {
      const nextOverview = await fetchOverview(force);
      setOverview(nextOverview);
      setError(null);
      return nextOverview;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "모델 운영 정보를 불러오지 못했습니다.");
      return null;
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let timer: number | null = null;
    const refresh = async (force = false) => {
      const snapshot = await loadOverview(force);
      const cacheAge = snapshot ? Date.now() - snapshot.updatedAt.getTime() : 0;
      const nextRefresh = snapshot
        ? Math.max(1_000, OVERVIEW_REFRESH_MS - cacheAge)
        : OVERVIEW_REFRESH_MS;
      if (active) timer = window.setTimeout(() => void refresh(true), nextRefresh);
    };
    void refresh();
    return () => {
      active = false;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [loadOverview]);

  const datasets = overview?.datasets ?? [];
  const runs = overview?.runs ?? [];
  const serving = overview?.serving ?? null;
  const labelSummary = overview?.labelSummary ?? null;
  const inference = overview?.inference ?? null;
  const platform = overview?.platform ?? null;
  const updatedAt = overview?.updatedAt ?? null;
  const productionRun = runs.find((run) => run.status === "PRODUCTION") ?? null;

  useEffect(() => {
    if (!productionRun?.mlflow_run_id) {
      setProductionDetails(null);
      setIsDetailsLoading(false);
      return;
    }
    let active = true;
    setProductionDetails(null);
    setIsDetailsLoading(true);
    void fetchProductionDetails(productionRun.id)
      .then((details) => { if (active) setProductionDetails(details); })
      .finally(() => { if (active) setIsDetailsLoading(false); });
    return () => { active = false; };
  }, [productionRun?.id, productionRun?.mlflow_run_id]);

  const latestDataset = datasets[0] ?? null;
  const latestRun = runs[0] ?? null;
  const actionRuns = runs.filter((run) => ACTION_REQUIRED_STATUSES.has(run.status));
  const actionPageCount = Math.max(1, Math.ceil(actionRuns.length / ACTION_RUNS_PER_PAGE));
  const currentActionPage = Math.min(actionPage, actionPageCount);
  const visibleActionRuns = actionRuns.slice(
    (currentActionPage - 1) * ACTION_RUNS_PER_PAGE,
    currentActionPage * ACTION_RUNS_PER_PAGE,
  );
  const trafficPercent = latestRevisionTraffic(serving);
  const latestRevision = resourceName(serving?.latest_ready_revision);
  const hasDisconnectedRun = Boolean(serving && trafficPercent > 0 && !productionRun);
  const confirmedLabelCount = labelSummary
    ? labelSummary.normal_count + labelSummary.fraud_count
    : null;
  const labelingCompletion = labelSummary && labelSummary.total_count > 0
    ? Math.round((confirmedLabelCount ?? 0) / labelSummary.total_count * 100)
    : 0;
  const latestDatasetLabelCount = latestDataset
    ? latestDataset.period_normal_count + latestDataset.period_fraud_count
    : null;
  const runtimeState = serving && platform?.database_status === "UP"
    ? serving.reconciling ? "트래픽 전환 중" : "서비스 정상"
    : "상태 확인 필요";
  const productionTitle = productionDetails?.model_version
    ? `운영 모델 v${productionDetails.model_version}`
    : productionRun?.model_key ?? (hasDisconnectedRun ? "운영 Run 미연결" : "운영 모델 없음");
  let productionDescription = "운영 모델과 Serving 연결 상태를 확인하세요.";
  if (productionRun) {
    productionDescription = "현재 거래 트래픽을 받는 모델과 Serving 연결 상태입니다.";
  } else if (serving) {
    productionDescription = "Serving은 연결됐지만 운영 트래픽을 받는 Run이 없습니다.";
  }
  if (hasDisconnectedRun) {
    productionDescription = "Cloud Run은 트래픽을 처리 중이지만 Backend 운영 Run 연결 정보가 없습니다.";
  }
  const isOverviewRefreshing = isRefreshing || isDetailsLoading;

  return (
    <ModelPageShell
      activeSection="overview"
      actions={<Link className="admin-button primary model-overview-action" to="/models/training">새 학습 준비</Link>}
    >
      {error && <AdminAlert message={error} onDismiss={() => setError(null)} tone="error" />}

      {!overview && isRefreshing ? <ModelOverviewSkeleton /> : <>
        <section className="model-command-grid">
        <article className="admin-panel production-command">
          <header>
            <div>
              <p className="admin-eyebrow">LIVE MODEL</p>
              <span className={`status ${productionRun ? "production" : hasDisconnectedRun ? "staged" : "failed"}`}>
                {productionRun ? "PRODUCTION" : hasDisconnectedRun ? "RUN 미연결" : "미배포"}
              </span>
            </div>
            <small
              aria-live="polite"
              className={`model-overview-refresh-status ${isOverviewRefreshing ? "loading" : ""}`}
            >
              {isOverviewRefreshing && <i aria-hidden="true" />}
              {isOverviewRefreshing ? "모델 정보 갱신 중" : updatedAt ? `${formatClock(updatedAt)} 갱신` : "상태 확인 중"}
            </small>
          </header>
          <div className="production-overview">
            <div className="production-overview-copy">
              <div className="production-command-main">
                <span>{productionRun ? `Backend Run #${productionRun.id}` : serving ? "Cloud Run Serving" : "배포 대기"}</span>
                <h2>{productionTitle}</h2>
                <p>{productionDescription}</p>
              </div>
              <dl className="production-facts">
                <div><dt>Backend 운영 Run</dt><dd className={hasDisconnectedRun ? "accent" : undefined}>{productionRun ? `#${productionRun.id}` : hasDisconnectedRun ? "미연결" : "—"}</dd></div>
                <div><dt>결정 임계값</dt><dd>{productionDetails?.params.decision_threshold ?? "—"}</dd></div>
                <div><dt>Ready 리비전</dt><dd title={latestRevision ?? undefined}>{latestRevision ?? "—"}</dd></div>
                <div><dt>최근 추론</dt><dd>{inference?.latest_inference_at ? formatClock(inference.latest_inference_at) : inference ? "최근 5분 없음" : "—"}</dd></div>
              </dl>
            </div>
            <div className="production-live-state">
              <strong className={serving?.reconciling ? "accent" : serving ? "positive" : ""}>
                {serving?.reconciling ? "트래픽 전환 중" : serving ? "Serving 연결" : "상태 확인 불가"}
              </strong>
              <div
                aria-label={`Ready 리비전 운영 트래픽 ${serving ? `${trafficPercent}%` : "확인 불가"}`}
                className={`traffic-ring compact ${serving?.reconciling ? "changing" : ""}`}
                role="img"
                style={{ "--traffic": `${trafficPercent * 3.6}deg` } as CSSProperties}
              >
                <strong>{serving ? `${trafficPercent}%` : "—"}</strong>
                <span>Ready 트래픽</span>
              </div>
            </div>
          </div>
        </article>

        <aside className="admin-panel model-action-inbox">
          <header><div><p className="admin-eyebrow">ACTION QUEUE</p><h2>조치가 필요한 학습</h2></div><strong>{actionRuns.length}</strong></header>
          <div className="model-action-list">
            {actionRuns.length === 0 ? (
              <div className="model-empty-state"><strong>대기 중인 작업이 없습니다.</strong><span>후보 검토나 배포 확인이 필요하면 여기에 표시됩니다.</span></div>
            ) : visibleActionRuns.map((run) => (
              <Link key={run.id} to={`/models/runs/${run.id}`}>
                <div><strong>{actionLabel(run.status)}</strong><span>학습 #{run.id} · {formatDate(run.created_at)}</span></div>
                <em className={`status ${run.status.toLowerCase()}`}>{STATUS_LABELS[run.status]}</em>
              </Link>
            ))}
          </div>
          <footer className="model-action-footer">
            <Link className="inbox-footer-link" to="/models/training">학습·배포 이력 전체 보기</Link>
            {actionRuns.length > ACTION_RUNS_PER_PAGE && (
              <nav aria-label="조치가 필요한 학습 페이지" className="model-action-pagination">
                <button disabled={currentActionPage === 1} onClick={() => setActionPage(currentActionPage - 1)} type="button">이전</button>
                <span><strong>{currentActionPage}</strong> / {actionPageCount}</span>
                <button disabled={currentActionPage === actionPageCount} onClick={() => setActionPage(currentActionPage + 1)} type="button">다음</button>
              </nav>
            )}
          </footer>
        </aside>
        </section>

        <section aria-label="라벨링부터 운영까지 모델 업무 흐름" className="model-summary-grid">
        <Link to="/models/labeling">
          <header>
            <div className="model-summary-heading">
              <b aria-hidden="true">01</b>
              <div><small>HUMAN LABELS</small><h3>거래 라벨링</h3></div>
            </div>
            <em>검토 열기 →</em>
          </header>
          <div className="model-summary-primary">
            <span>지금 확인할 거래</span>
            <strong>{labelSummary ? numberFormat.format(labelSummary.unlabeled_count) : "—"}<small>건</small></strong>
            <p>{labelSummary ? `담당자 판정 ${labelingCompletion}% 완료` : "라벨 집계를 확인하고 있습니다."}</p>
          </div>
          <ul className="model-summary-details">
            <li>
              <i className="accent" />
              <div><span>담당자 판정 완료</span><small>전체 {labelSummary ? numberFormat.format(labelSummary.total_count) : "—"}건</small></div>
              <strong>{confirmedLabelCount === null ? "—" : numberFormat.format(confirmedLabelCount)}<small>건</small></strong>
            </li>
            <li>
              <i className="positive" />
              <div><span>정상 확정</span><small>학습용 정상 라벨</small></div>
              <strong className="positive">{labelSummary ? numberFormat.format(labelSummary.normal_count) : "—"}<small>건</small></strong>
            </li>
            <li>
              <i className="danger" />
              <div><span>사기 확정</span><small>학습용 사기 라벨</small></div>
              <strong className="danger">{labelSummary ? numberFormat.format(labelSummary.fraud_count) : "—"}<small>건</small></strong>
            </li>
          </ul>
        </Link>
        <Link to="/models/training">
          <header>
            <div className="model-summary-heading">
              <b aria-hidden="true">02</b>
              <div><small>TRAIN & RELEASE</small><h3>학습 · 배포</h3></div>
            </div>
            <em>이력 열기 →</em>
          </header>
          <div className="model-summary-primary">
            <span>다음 학습 · 배포 작업</span>
            <strong className="text-value">{actionRuns.length > 0 ? `${numberFormat.format(actionRuns.length)}건 확인 필요` : latestRun ? "대기 작업 없음" : "첫 학습 준비"}</strong>
            <p>{actionRuns.length > 0 ? "후보 검토 또는 배포 확인이 필요합니다." : latestRun ? `최근 Run #${latestRun.id} · ${formatDate(latestRun.created_at)}` : "데이터셋을 만든 뒤 학습을 실행하세요."}</p>
          </div>
          <ol className="model-summary-details workflow">
            <li>
              <i>1</i>
              <div><span>학습 데이터셋</span><small title={latestDataset?.version}>{latestDataset?.version ?? "생성 전"}</small></div>
              <strong>{latestDataset ? numberFormat.format(latestDataset.row_count) : "—"}<small>행</small></strong>
            </li>
            <li>
              <i>2</i>
              <div><span>최근 학습 Run</span><small>{latestRun ? `Run #${latestRun.id}` : "실행 전"}</small></div>
              <strong>{latestRun ? STATUS_LABELS[latestRun.status] : "—"}</strong>
            </li>
            <li>
              <i>3</i>
              <div><span>운영 전환</span><small>{productionRun ? `Ready 트래픽 ${trafficPercent}%` : "후보 검토 후 배포"}</small></div>
              <strong>{productionRun ? `Run #${productionRun.id}` : latestDatasetLabelCount === null ? "—" : `${numberFormat.format(latestDatasetLabelCount)} 라벨`}</strong>
            </li>
          </ol>
        </Link>
        <Link to="/models/monitoring">
          <header>
            <div className="model-summary-heading">
              <b aria-hidden="true">03</b>
              <div><small>RUNTIME HEALTH</small><h3>운영 모니터링</h3></div>
            </div>
            <em>모니터링 열기 →</em>
          </header>
          <div className="model-summary-primary">
            <span>현재 서비스 상태</span>
            <strong className={`text-value ${runtimeState === "서비스 정상" ? "positive" : serving?.reconciling ? "accent" : "danger"}`}>{runtimeState}</strong>
            <p>{inference?.latest_inference_at ? `마지막 추론 ${formatClock(inference.latest_inference_at)}` : inference ? `최근 ${inference.window_minutes}분 추론 요청 없음` : "운영 지표를 확인하고 있습니다."}</p>
          </div>
          <ul className="model-summary-details">
            <li>
              <i className="accent" />
              <div><span>추론 API</span><small>P95 {inference?.p95_latency_ms === null || inference?.p95_latency_ms === undefined ? "—" : `${numberFormat.format(inference.p95_latency_ms)}ms`}</small></div>
              <strong>{inference ? numberFormat.format(inference.inference_count) : "—"}<small>건</small></strong>
            </li>
            <li>
              <i className={serving?.reconciling ? "accent" : serving ? "positive" : "danger"} />
              <div><span>Cloud Run Serving</span><small>Ready 트래픽 {serving ? `${trafficPercent}%` : "—"}</small></div>
              <strong className={serving?.reconciling ? "accent" : serving ? "positive" : "danger"}>{serving?.reconciling ? "전환 중" : serving ? "연결" : "확인 필요"}</strong>
            </li>
            <li>
              <i className={platform?.database_status === "UP" ? "positive" : "danger"} />
              <div><span>PostgreSQL</span><small>응답 {platform?.database_latency_ms === null || platform?.database_latency_ms === undefined ? "—" : `${numberFormat.format(platform.database_latency_ms)}ms`}</small></div>
              <strong className={platform ? platform.database_status === "UP" ? "positive" : "danger" : undefined}>{platform?.database_status ?? "—"}</strong>
            </li>
          </ul>
        </Link>
        </section>
      </>}
    </ModelPageShell>
  );
}
