// 모델 관리의 시작점: 현재 운영 모델과 다음에 처리할 업무만 요약한다.

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
  fetchModelDetails,
  fetchServingStatus,
  fetchTrainingRuns,
} from "./mlopsApi";
import type {
  DatasetVersion,
  ModelDetails,
  ServingStatus,
  TrainingRun,
} from "./mlopsTypes";

const OVERVIEW_REFRESH_MS = 15_000;

export function ModelManagementPage() {
  const [datasets, setDatasets] = useState<DatasetVersion[]>([]);
  const [runs, setRuns] = useState<TrainingRun[]>([]);
  const [serving, setServing] = useState<ServingStatus | null>(null);
  const [productionDetails, setProductionDetails] = useState<ModelDetails | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const [datasetRows, trainingRows] = await Promise.all([
        fetchDatasets(),
        fetchTrainingRuns(),
      ]);
      setDatasets(datasetRows);
      setRuns(trainingRows);
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
                <span>{productionRun ? `Run #${productionRun.id}` : "배포 대기"}</span>
                <h2>{productionDetails?.model_version
                  ? `운영 모델 v${productionDetails.model_version}`
                  : productionRun ? productionRun.model_key : "운영 모델 없음"}</h2>
                <p>현재 거래 트래픽을 받는 모델의 배포 식별 정보입니다.</p>
              </div>
              <dl className="production-facts">
                <div><dt>MLflow 모델</dt><dd title={productionDetails?.model_name}>{productionDetails?.model_name ?? productionRun?.model_key ?? "—"}</dd></div>
                <div><dt>Feature 계약</dt><dd>{productionDetails?.tags.feature_contract ?? "—"}</dd></div>
                <div><dt>결정 임계값</dt><dd>{productionDetails?.params.decision_threshold ?? "—"}</dd></div>
                <div><dt>Ready 리비전</dt><dd title={latestRevision ?? undefined}>{latestRevision ?? "—"}</dd></div>
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
        </article>

        <aside className="admin-panel model-action-inbox">
          <header><div><p className="admin-eyebrow">ACTION QUEUE</p><h2>조치가 필요한 Run</h2></div><strong>{actionRuns.length}</strong></header>
          <div className="model-action-list">
            {actionRuns.length === 0 ? (
              <div className="model-empty-state"><strong>대기 중인 작업이 없습니다.</strong><span>후보 검토나 배포 확인이 필요하면 여기에 표시됩니다.</span></div>
            ) : actionRuns.slice(0, 5).map((run) => (
              <Link key={run.id} to={`/models/runs/${run.id}`}>
                <div><strong>Run #{run.id}</strong><span>{formatDate(run.created_at)}</span></div>
                <em className={`status ${run.status.toLowerCase()}`}>{STATUS_LABELS[run.status]}</em>
              </Link>
            ))}
          </div>
          <Link className="inbox-footer-link" to="/models/training">학습·배포 이력 전체 보기</Link>
        </aside>
      </section>

      <section aria-label="모델 운영 업무" className="model-workflow-grid">
        <Link to="/models/labeling">
          <small>01 · HUMAN LABELS</small>
          <h3>거래 라벨링</h3>
          <p>담당자가 확정한 정상·사기 판정만 다음 학습 데이터에 반영합니다.</p>
          <footer><strong>미판정 거래 검토</strong><em>열기 →</em></footer>
        </Link>
        <Link to="/models/training">
          <small>02 · TRAIN & RELEASE</small>
          <h3>학습 · 배포</h3>
          <p title={latestDataset?.version}>{latestDataset?.version ?? "학습 데이터셋을 먼저 준비하세요."}</p>
          <footer>
            <strong>{latestRun ? `Run #${latestRun.id} · ${STATUS_LABELS[latestRun.status]}` : "실행 이력 없음"}</strong>
            <em>열기 →</em>
          </footer>
        </Link>
        <Link to="/models/monitoring">
          <small>03 · RUNTIME HEALTH</small>
          <h3>서버 모니터링</h3>
          <p>추론 서비스, 학습 Job, VM·DB 상태와 시계열을 분리해 확인합니다.</p>
          <footer><strong>{serving ? "Serving 연결됨" : "상태 확인 필요"}</strong><em>열기 →</em></footer>
        </Link>
      </section>
    </ModelPageShell>
  );
}
