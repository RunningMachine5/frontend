// 모델 운영의 현재 상태와 담당자가 처리할 Run을 한 화면에 요약한다.

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";

import { AdminAlert } from "../admin/AdminAlert";
import { ModelPageShell } from "./components/ModelPageShell";
import {
  ACTION_REQUIRED_STATUSES,
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
  fetchServingStatus,
  fetchTrainingRuns,
} from "./mlopsApi";
import type {
  DatasetVersion,
  InferencePerformance,
  ModelDetails,
  ServingStatus,
  TrainingRun,
} from "./mlopsTypes";

const OVERVIEW_REFRESH_MS = 5_000;

export function ModelManagementPage() {
  const [datasets, setDatasets] = useState<DatasetVersion[]>([]);
  const [runs, setRuns] = useState<TrainingRun[]>([]);
  const [serving, setServing] = useState<ServingStatus | null>(null);
  const [performance, setPerformance] = useState<InferencePerformance | null>(null);
  const [productionDetails, setProductionDetails] = useState<ModelDetails | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const [datasetRows, trainingRows, inference] = await Promise.all([
        fetchDatasets(),
        fetchTrainingRuns(),
        fetchInferencePerformance(),
      ]);
      setDatasets(datasetRows);
      setRuns(trainingRows);
      setPerformance(inference);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "모델 운영 정보를 불러오지 못했습니다.");
    }
    try {
      setServing(await fetchServingStatus());
    } catch {
      setServing(null);
    }
    setUpdatedAt(new Date());
  }, []);

  useEffect(() => {
    let active = true;
    let timer: number | null = null;
    const refresh = async () => {
      await loadOverview();
      if (active) timer = window.setTimeout(() => void refresh(), OVERVIEW_REFRESH_MS);
    };
    void refresh();
    return () => {
      active = false;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [loadOverview]);

  const productionRun = runs.find((run) => run.status === "PRODUCTION") ?? null;

  useEffect(() => {
    if (!productionRun?.mlflow_run_id) {
      setProductionDetails(null);
      return;
    }
    let active = true;
    void fetchModelDetails(productionRun.id)
      .then((details) => { if (active) setProductionDetails(details); })
      .catch(() => { if (active) setProductionDetails(null); });
    return () => { active = false; };
  }, [productionRun?.id, productionRun?.mlflow_run_id]);

  const latestDataset = datasets[0] ?? null;
  const latestRun = runs[0] ?? null;
  const actionRuns = runs.filter((run) => ACTION_REQUIRED_STATUSES.has(run.status));
  const trafficPercent = latestRevisionTraffic(serving);
  const latestRevision = resourceName(serving?.latest_ready_revision);

  return (
    <ModelPageShell
      activeSection="overview"
      actions={<Link className="admin-button primary model-overview-action" to="/models/training">새 학습 준비</Link>}
      title="모델 운영 현황"
    >
      {error && <AdminAlert message={error} onDismiss={() => setError(null)} tone="error" />}

      <section className="model-command-grid">
        <article className="admin-panel production-command">
          <header>
            <div>
              <p className="admin-eyebrow">LIVE MODEL</p>
              <span className={`status ${productionRun ? "production" : "failed"}`}>
                {productionRun ? "PRODUCTION" : "미배포"}
              </span>
            </div>
            <small>{updatedAt ? `${formatClock(updatedAt)} 갱신` : "상태 확인 중"}</small>
          </header>
          <div className="production-overview">
            <div className="production-overview-copy">
              <div className="production-command-main">
                <h2>{productionDetails?.model_version
                  ? `운영 모델 v${productionDetails.model_version}`
                  : productionRun ? `운영 Run #${productionRun.id}` : "운영 모델 없음"}</h2>
                <p>실제 거래 요청을 처리하는 모델과 최근 추론 신호입니다.</p>
              </div>
              <dl className="production-facts">
                <div><dt>Feature 계약</dt><dd>{productionDetails?.tags.feature_contract ?? "—"}</dd></div>
                <div><dt>결정 임계값</dt><dd>{productionDetails?.params.decision_threshold ?? "—"}</dd></div>
                <div><dt>Ready 리비전</dt><dd title={latestRevision ?? undefined}>{latestRevision ?? "—"}</dd></div>
                <div><dt>운영 트래픽</dt><dd>{serving ? `${trafficPercent}%` : "—"}</dd></div>
              </dl>
            </div>
            <div className="production-live-state">
              <strong className={serving?.reconciling ? "accent" : serving ? "positive" : ""}>
                {serving?.reconciling ? "트래픽 전환 중" : serving ? "정상 운영" : "상태 확인 불가"}
              </strong>
              <div
                aria-label={`Ready 리비전 운영 트래픽 ${serving ? `${trafficPercent}%` : "확인 불가"}`}
                className={`traffic-ring compact ${serving?.reconciling ? "changing" : ""}`}
                role="img"
                style={{ "--traffic": `${trafficPercent * 3.6}deg` } as CSSProperties}
              >
                <strong>{serving ? `${trafficPercent}%` : "—"}</strong>
                <span>운영 트래픽</span>
              </div>
            </div>
          </div>
          <section aria-label="최근 온라인 추론" className="overview-inference-strip">
            <div><span>최근 {performance?.window_minutes ?? 5}분 추론</span><strong>{performance?.inference_count.toLocaleString("ko-KR") ?? "—"}<small>건</small></strong></div>
            <div><span>응답 P95</span><strong>{performance?.p95_latency_ms ?? "—"}<small>ms</small></strong></div>
            <div><span>마지막 추론</span><strong>{performance?.latest_inference_at ? formatClock(performance.latest_inference_at) : "대기 중"}</strong></div>
          </section>
        </article>

        <aside className="admin-panel model-action-inbox">
          <header><div><p className="admin-eyebrow">ACTION QUEUE</p><h2>조치가 필요한 Run</h2></div><strong>{actionRuns.length}</strong></header>
          <div className="model-action-list">
            {actionRuns.length === 0 ? (
              <div className="model-empty-state"><strong>대기 중인 작업이 없습니다.</strong><span>새 학습을 시작하면 진행 상태가 여기에 표시됩니다.</span></div>
            ) : actionRuns.slice(0, 5).map((run) => (
              <Link key={run.id} to={`/models/runs/${run.id}`}>
                <div><strong>Run #{run.id}</strong><span>{formatDate(run.created_at)}</span></div>
                <em className={`status ${run.status.toLowerCase()}`}>{STATUS_LABELS[run.status]}</em>
              </Link>
            ))}
          </div>
          <Link className="inbox-footer-link" to="/models/training">전체 학습 이력 보기</Link>
        </aside>
      </section>

      <section className="model-context-strip">
        <article>
          <span>최근 데이터셋</span>
          <strong>{latestDataset?.version ?? "준비되지 않음"}</strong>
          <small>{latestDataset ? `${latestDataset.row_count.toLocaleString("ko-KR")}행 · ${formatDate(latestDataset.created_at)}` : "학습 데이터셋을 먼저 생성하세요."}</small>
        </article>
        <article>
          <span>최근 학습 Run</span>
          <strong>{latestRun ? `Run #${latestRun.id}` : "실행 이력 없음"}</strong>
          <small>{latestRun ? `${STATUS_LABELS[latestRun.status]} · ${formatDate(latestRun.created_at)}` : "데이터셋 준비 후 학습을 실행하세요."}</small>
        </article>
        <article>
          <span>Cloud Monitoring</span>
          <strong>준실시간 인프라 지표</strong>
          <small>인스턴스·요청·지연·자원 사용률은 별도 화면에서 확인합니다.</small>
          <Link to="/models/monitoring">성능 모니터링 열기</Link>
        </article>
      </section>
    </ModelPageShell>
  );
}
