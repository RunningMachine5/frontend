import { useCallback, useEffect, useState, type CSSProperties } from "react";

import { AppLayout } from "../../components/layout/AppLayout";
import {
  buildDataset,
  completeDeployment,
  decideModel,
  fetchDatasets,
  fetchModelDetails,
  fetchServingStatus,
  fetchTrainingRuns,
  promoteModel,
  startTraining,
} from "./mlopsApi";
import type { DatasetVersion, ModelDetails, ServingStatus, TrainingRun } from "./mlopsTypes";
import "../admin/AdminWorkspace.css";

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: "요청됨", RUNNING: "학습 중", CANDIDATE: "검토 대기", REJECTED: "거절",
  STAGED: "0% 검증", PROMOTING: "전환 중", PRODUCTION: "운영 중", FAILED: "실패",
  DEPLOYMENT_FAILED: "배포 실패",
};

const SERVING_REFRESH_MS = 5_000;
const LATEST_TRAFFIC_TYPE = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST";
const ACTION_REQUIRED_STATUSES = new Set(["CANDIDATE", "STAGED", "PROMOTING", "FAILED", "DEPLOYMENT_FAILED"]);

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function metric(details: ModelDetails | null, ...keys: string[]) {
  for (const key of keys) if (details?.metrics[key] !== undefined) return details.metrics[key];
  return null;
}

function metricText(value: number | null) {
  return value === null ? "—" : value.toFixed(4);
}

function resourceName(value: string | null | undefined) {
  return value?.split("/").at(-1) ?? null;
}

function latestRevisionTraffic(status: ServingStatus) {
  const latestReadyRevision = resourceName(status.latest_ready_revision);
  if (!latestReadyRevision) return 0;

  const percent = status.traffic.reduce((sum, target) => {
    const targetRevision = target.revision
      ? resourceName(target.revision)
      : target.type === LATEST_TRAFFIC_TYPE
        ? resourceName(status.latest_created_revision)
        : null;
    return targetRevision === latestReadyRevision ? sum + (target.percent ?? 0) : sum;
  }, 0);

  return Math.min(100, Math.max(0, percent));
}

function formatClock(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

export function ModelManagementPage() {
  const [datasets, setDatasets] = useState<DatasetVersion[]>([]);
  const [runs, setRuns] = useState<TrainingRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [details, setDetails] = useState<ModelDetails | null>(null);
  const [productionDetails, setProductionDetails] = useState<ModelDetails | null>(null);
  const [serving, setServing] = useState<ServingStatus | null>(null);
  const [servingUpdatedAt, setServingUpdatedAt] = useState<Date | null>(null);
  const [dialog, setDialog] = useState<"dataset" | "training" | "promotion" | null>(null);
  const [datasetVersion, setDatasetVersion] = useState("");
  const [datasetUri, setDatasetUri] = useState("");
  const [trainingDatasetId, setTrainingDatasetId] = useState<number | null>(null);
  const [transactionId, setTransactionId] = useState("");
  const [promotionJson, setPromotionJson] = useState("{}");
  const [operationId, setOperationId] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isListsLoading, setIsListsLoading] = useState(true);
  const [isServingLoading, setIsServingLoading] = useState(true);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? null;

  const loadDetails = useCallback(async (run: TrainingRun) => {
    setSelectedRunId(run.id);
    setIsDetailsLoading(true);
    try {
      if (!run.mlflow_run_id) { setDetails(null); return; }
      try { setDetails(await fetchModelDetails(run.id)); }
      catch { setDetails(null); }
    } finally {
      setIsDetailsLoading(false);
    }
  }, []);

  const loadLists = useCallback(async (keepSelectedRunId: number | null = null) => {
    setIsListsLoading(true);
    setError(null);
    try {
      const [datasetRows, trainingRows] = await Promise.all([
        fetchDatasets(),
        fetchTrainingRuns(),
      ]);
      setDatasets(datasetRows);
      setRuns(trainingRows);
      setTrainingDatasetId((current) => current ?? datasetRows[0]?.id ?? null);
      const production = trainingRows.find((run) => run.status === "PRODUCTION") ?? null;
      if (production?.mlflow_run_id) {
        try { setProductionDetails(await fetchModelDetails(production.id)); }
        catch { setProductionDetails(null); }
      } else {
        setProductionDetails(null);
      }
      const preferred = trainingRows.find((run) => run.id === keepSelectedRunId)
        ?? production
        ?? trainingRows[0];
      if (preferred) void loadDetails(preferred);
      else { setSelectedRunId(null); setDetails(null); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "모델 관리 정보를 불러오지 못했습니다.");
    } finally {
      setIsListsLoading(false);
    }
  }, [loadDetails]);

  const loadServing = useCallback(async (showLoading = true) => {
    if (showLoading) setIsServingLoading(true);
    // 로컬 개발에서는 GCP 자격증명이 없어 Serving 상태만 실패할 수 있다.
    // 데이터셋과 학습 이력까지 함께 숨기지 않고 해당 카드만 확인 불가로 둔다.
    try {
      setServing(await fetchServingStatus());
      setServingUpdatedAt(new Date());
    } catch {
      if (showLoading) setServing(null);
    } finally {
      if (showLoading) setIsServingLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([loadLists(selectedRunId), loadServing()]);
  }, [loadLists, loadServing, selectedRunId]);

  useEffect(() => {
    void loadLists();
    let isActive = true;
    let refreshTimer: number | null = null;

    async function pollServing(showLoading = false) {
      if (showLoading || document.visibilityState === "visible") {
        await loadServing(showLoading);
      }
      if (isActive) {
        refreshTimer = window.setTimeout(() => void pollServing(), SERVING_REFRESH_MS);
      }
    }

    void pollServing(true);
    return () => {
      isActive = false;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
    };
  }, [loadLists, loadServing]);

  useEffect(() => {
    if (!dialog) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialog(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [dialog]);

  const latestDataset = datasets[0] ?? null;
  const productionRun = runs.find((run) => run.status === "PRODUCTION") ?? null;
  const latestRun = runs[0] ?? null;
  const trafficPercent = serving ? latestRevisionTraffic(serving) : 0;
  const latestRevision = resourceName(serving?.latest_ready_revision);
  const actionRequiredRuns = runs.filter((run) => ACTION_REQUIRED_STATUSES.has(run.status));
  const recommendation = details?.tags.promotion_recommendation ?? "NOT_AVAILABLE";
  const selectedDataset = datasets.find((dataset) => dataset.id === selectedRun?.dataset_version_id);

  const nextAction = (() => {
    if (!latestDataset) return { label: "데이터셋 생성", detail: "학습에 사용할 데이터 버전을 먼저 준비하세요.", tone: "accent" };
    if (!latestRun) return { label: "학습 실행", detail: `${latestDataset.version} 데이터셋이 준비됐습니다.`, tone: "accent" };
    switch (latestRun.status) {
      case "REQUESTED": return { label: "학습 시작 대기", detail: `Run #${latestRun.id}이 실행을 기다리고 있습니다.`, tone: "accent" };
      case "RUNNING": return { label: "학습 완료 대기", detail: `Run #${latestRun.id}이 Cloud Run에서 학습 중입니다.`, tone: "accent" };
      case "CANDIDATE": return { label: "후보 지표 검토", detail: `Run #${latestRun.id}의 지표와 추천을 확인하세요.`, tone: "accent" };
      case "STAGED": return { label: "0% 후보 예측 검증", detail: `Run #${latestRun.id}을 실제 요청으로 검증하세요.`, tone: "accent" };
      case "PROMOTING": return { label: "운영 전환 확인", detail: `Run #${latestRun.id}의 트래픽 반영을 확인하세요.`, tone: "accent" };
      case "FAILED": return { label: "학습 실패 확인", detail: `Run #${latestRun.id}의 실행 로그를 확인하세요.`, tone: "danger" };
      case "DEPLOYMENT_FAILED": return { label: "배포 재시도", detail: `Run #${latestRun.id}의 실패 원인을 확인하세요.`, tone: "danger" };
      case "REJECTED": return { label: "새 학습 실행", detail: `Run #${latestRun.id} 후보가 거절됐습니다.`, tone: "accent" };
      default: return { label: "현재 조치 없음", detail: `Run #${latestRun.id}이 정상 운영 중입니다.`, tone: "positive" };
    }
  })();

  const reviewed = latestRun && ["STAGED", "PROMOTING", "PRODUCTION"].includes(latestRun.status);
  const verified = latestRun && ["PROMOTING", "PRODUCTION"].includes(latestRun.status);
  const workflowSteps = [
    {
      label: "데이터셋 생성",
      status: latestDataset ? "완료" : "생성 필요",
      state: latestDataset ? "complete" : "active",
    },
    {
      label: "Cloud Run 학습",
      status: latestRun ? (["REQUESTED", "RUNNING"].includes(latestRun.status) ? STATUS_LABELS[latestRun.status] : latestRun.status === "FAILED" ? "실패" : "완료") : latestDataset ? "실행 필요" : "대기",
      state: latestRun ? (["REQUESTED", "RUNNING"].includes(latestRun.status) ? "active" : latestRun.status === "FAILED" ? "error" : "complete") : latestDataset ? "active" : "pending",
    },
    {
      label: "지표·추천 검토",
      status: latestRun?.status === "CANDIDATE" ? "검토 필요" : latestRun?.status === "REJECTED" ? "거절" : reviewed ? "승인" : "대기",
      state: latestRun?.status === "CANDIDATE" ? "active" : latestRun?.status === "REJECTED" ? "error" : reviewed ? "complete" : "pending",
    },
    {
      label: "0% 후보 검증",
      status: latestRun?.status === "STAGED" ? "검증 필요" : latestRun?.status === "DEPLOYMENT_FAILED" ? "재시도" : verified ? "통과" : "대기",
      state: latestRun?.status === "STAGED" ? "active" : latestRun?.status === "DEPLOYMENT_FAILED" ? "error" : verified ? "complete" : "pending",
    },
    {
      label: "운영 트래픽 전환",
      status: latestRun?.status === "PROMOTING" ? `${trafficPercent}% 전환 중` : latestRun?.status === "PRODUCTION" ? `${trafficPercent}% 운영` : latestRun?.status === "DEPLOYMENT_FAILED" ? "전환 실패" : "대기",
      state: latestRun?.status === "PROMOTING" ? "active" : latestRun?.status === "PRODUCTION" ? "complete" : latestRun?.status === "DEPLOYMENT_FAILED" ? "error" : "pending",
    },
  ];

  const runAction = async (action: () => Promise<void>) => {
    setIsBusy(true); setError(null); setNotice(null);
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다."); }
    finally { setIsBusy(false); }
  };

  const createDataset = () => runAction(async () => {
    const created = await buildDataset(datasetVersion, datasetUri);
    setDialog(null);
    setDatasetVersion(""); setDatasetUri("");
    setNotice(`${created.version} 데이터셋을 생성했습니다.`);
    await refresh();
  });

  const launchTraining = () => runAction(async () => {
    if (!trainingDatasetId) return;
    const result = await startTraining(trainingDatasetId);
    setDialog(null);
    setSelectedRunId(result.training_run.id);
    setNotice(`학습 Run #${result.training_run.id}을 시작했습니다.`);
    await refresh();
  });

  const decide = (decision: "APPROVE" | "REJECT") => runAction(async () => {
    if (!selectedRun) return;
    const reason = decision === "APPROVE" ? "관리자 화면에서 지표와 0% 후보를 확인함" : "관리자 검토에서 후보를 거절함";
    await decideModel(selectedRun.id, decision, reason);
    setNotice(decision === "APPROVE" ? "후보 모델을 STAGED로 승인했습니다." : "후보 모델을 거절했습니다.");
    await refresh();
  });

  const promote = () => runAction(async () => {
    if (!selectedRun) return;
    const result = await promoteModel(selectedRun.id, Number(transactionId), JSON.parse(promotionJson));
    setOperationId(result.operation_id ?? "");
    setDialog(null);
    setNotice("후보 예측 검증을 통과해 운영 트래픽 전환을 요청했습니다.");
    await refresh();
  });

  const complete = () => runAction(async () => {
    if (!selectedRun) return;
    await completeDeployment(selectedRun.id, operationId);
    setNotice("운영 전환과 MLflow champion 지정을 완료했습니다.");
    await refresh();
  });

  return (
    <AppLayout activeNav="model">
      <section className="admin-page model-admin-page">
        <header className="admin-header">
          <div><p className="admin-eyebrow">MODEL OPERATIONS</p><h1>모델 관리</h1><p>학습 데이터셋 생성부터 후보 모델 검토와 운영 배포까지 관리합니다.</p></div>
          <div className="admin-actions">
            <button className="admin-button" onClick={() => setDialog("dataset")} type="button">새 데이터셋 생성</button>
            <button className="admin-button primary" disabled={datasets.length === 0} onClick={() => setDialog("training")} type="button">학습 실행</button>
          </div>
        </header>

        {error && <div className="admin-alert error" role="alert">{error}</div>}
        {notice && <div className="admin-alert success" role="status">{notice}</div>}
          <section className="operations-summary" aria-label="현재 필요한 모델 운영 정보">
            <article>
              <span>다음 작업</span>
              <strong className={nextAction.tone}>{nextAction.label}</strong>
              <small>{nextAction.detail}</small>
            </article>
            <article>
              <span>조치 대기</span>
              <strong>{actionRequiredRuns.length ? `${actionRequiredRuns.length}건` : "없음"}</strong>
              <small>{actionRequiredRuns[0] ? `Run #${actionRequiredRuns[0].id} · ${STATUS_LABELS[actionRequiredRuns[0].status]}` : "검토 또는 배포 작업이 없습니다."}</small>
            </article>
            <article aria-busy={isServingLoading}>
              <span>Serving</span>
              <strong aria-live="polite" className={serving?.reconciling ? "accent" : serving ? "positive" : ""}>{isServingLoading ? "확인 중" : serving ? serving.reconciling ? "트래픽 전환 중" : "정상 운영" : "확인 불가"}</strong>
              <small>{latestRevision ? `${latestRevision} · ${trafficPercent}%` : "Ready 리비전 없음"}{servingUpdatedAt ? ` · ${formatClock(servingUpdatedAt)} 자동 갱신` : ""}</small>
            </article>
          </section>

          <section className="model-overview-grid">
            <article className="admin-panel champion-card">
              <div><em className="status production">{productionRun ? "PRODUCTION" : "미배포"}</em><h2>{productionDetails?.model_version ? `운영 모델 v${productionDetails.model_version}` : productionRun ? `운영 모델 Run #${productionRun.id}` : "운영 모델 없음"}</h2><p>현재 운영 트래픽에 연결된 모델과 MLflow alias 정보를 확인합니다.</p><dl><div><dt>Feature 계약</dt><dd>{productionDetails?.tags.feature_contract ?? "—"}</dd></div><div><dt>결정 임계값</dt><dd>{productionDetails?.params.decision_threshold ?? "—"}</dd></div><div><dt>MLflow Alias</dt><dd>{productionRun ? "champion" : "—"}</dd></div></dl></div>
              <div aria-label={`최신 배포 리비전 트래픽 ${serving ? `${trafficPercent}%` : "확인 불가"}`} className={`traffic-ring${serving?.reconciling ? " changing" : ""}`} role="img" style={{ "--traffic": `${trafficPercent * 3.6}deg` } as CSSProperties}><strong>{serving ? `${trafficPercent}%` : "—"}</strong><span>배포 대상 트래픽</span></div>
            </article>
            <article className="admin-panel dataset-card">
              <p className="admin-eyebrow">LATEST DATASET</p><h2>{latestDataset?.version ?? "생성된 데이터셋 없음"}</h2><p>확정 라벨 거래를 원본 학습 데이터에 합친 불변 버전입니다.</p>
              <dl><div><dt>전체 행</dt><dd>{latestDataset?.row_count.toLocaleString("ko-KR") ?? "—"}</dd></div><div><dt>최근 생성</dt><dd>{latestDataset ? formatDate(latestDataset.created_at) : "—"}</dd></div><div><dt>저장 위치</dt><dd title={latestDataset?.gcs_uri}>{latestDataset?.gcs_uri.replace(/^gs:\/\/[^/]+\//, "GCS · ") ?? "—"}</dd></div></dl>
              <button className="admin-button compact" onClick={() => setDialog("dataset")} type="button">새 버전 생성</button>
            </article>
          </section>

          <ol className="workflow-rail" aria-label="모델 운영 5단계">
            {workflowSteps.map((step, index) => <li className={`workflow-step ${step.state}`} key={step.label}><small>0{index + 1}</small><div><strong>{step.label}</strong><span>{step.status}</span></div></li>)}
          </ol>

          <section className="model-workspace">
            <article className="admin-panel runs-panel">
              <div className="panel-title split"><div><p className="admin-eyebrow">TRAINING RUNS</p><h2>학습 실행 이력</h2><small>행을 선택하면 MLflow 원본 지표와 배포 상태를 조회합니다.</small></div><button className="admin-button compact" disabled={isBusy || isListsLoading || isServingLoading} onClick={() => void refresh()} type="button">{isListsLoading || isServingLoading ? "새로고침 중..." : "상태 새로고침"}</button></div>
              <div className="admin-table-wrap"><table><thead><tr><th>Run</th><th>데이터셋</th><th>상태</th><th>MLflow Run</th><th>실행 시각</th></tr></thead><tbody>{runs.map((run) => <tr className={selectedRunId === run.id ? "selected" : ""} key={run.id}><td><button className="table-run-button" onClick={() => void loadDetails(run)} type="button">#{run.id}</button></td><td>{datasets.find((item) => item.id === run.dataset_version_id)?.version ?? `#${run.dataset_version_id}`}</td><td><em className={`status ${run.status.toLowerCase()}`}>{STATUS_LABELS[run.status]}</em></td><td>{run.mlflow_run_id?.slice(0, 10) ?? "—"}</td><td>{formatDate(run.created_at)}</td></tr>)}</tbody></table></div>
            </article>

            <aside aria-busy={isDetailsLoading} className="admin-panel model-detail">
              <div className="panel-title split"><div><p className="admin-eyebrow">MODEL DETAIL</p><h2>{selectedRun ? `Run #${selectedRun.id}${details ? ` · model v${details.model_version}` : ""}` : "학습 Run 선택"}</h2><small>{selectedDataset?.version ?? "MLflow 원본 지표를 조회합니다."}</small></div>{details && <em className="recommendation">{recommendation.replaceAll("_", " ")}</em>}</div>
              {isDetailsLoading ? <div className="model-detail-loading" role="status"><i aria-hidden="true" /><strong>MLflow 모델 정보를 불러오는 중입니다.</strong><span>선택한 Run의 지표와 배포 상태를 확인하고 있습니다.</span></div> : <>
                <div className="metric-pairs">{[["PR-AUC", metric(details, "validation_pr_auc")], ["ROC-AUC", metric(details, "validation_roc_auc")], ["Recall", metric(details, "validation_recall")], ["F1 Score", metric(details, "validation_f1")], ["Precision", metric(details, "validation_precision")], ["FPR", metric(details, "validation_fpr")]].map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{metricText(value as number | null)}</strong></div>)}</div>
                {selectedRun?.status === "CANDIDATE" && <p className="review-note"><strong>검토 필요</strong>ML Serving CD에서 이 모델 버전의 0% 후보 revision을 준비한 뒤 승인하세요.</p>}
                {selectedRun && <div className="model-actions">
                  <button className="admin-button danger-button" disabled={selectedRun.status !== "CANDIDATE" || isBusy} onClick={() => void decide("REJECT")} type="button">후보 거절</button>
                  <button className="admin-button primary" disabled={selectedRun.status !== "CANDIDATE" || isBusy} onClick={() => void decide("APPROVE")} type="button">승인 후 STAGED</button>
                  <button className="admin-button primary wide" disabled={!(["STAGED", "DEPLOYMENT_FAILED"] as string[]).includes(selectedRun.status) || isBusy} onClick={() => setDialog("promotion")} type="button">예측 검증 후 100% 전환</button>
                  <button className="admin-button wide" disabled={selectedRun.status !== "PROMOTING" || isBusy} onClick={() => void complete()} type="button">배포 완료 확인</button>
                </div>}
              </>}
            </aside>
          </section>
        {dialog === "dataset" && <div className="admin-dialog-backdrop" onMouseDown={() => setDialog(null)} role="presentation"><section aria-modal="true" className="admin-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog"><header><div><p className="admin-eyebrow">DATASET VERSION</p><h2>새 학습 데이터셋 생성</h2></div><button onClick={() => setDialog(null)} type="button">닫기</button></header><label><span>버전 이름</span><input onChange={(event) => setDatasetVersion(event.target.value)} placeholder="train-labeled-20260818-v1" value={datasetVersion} /></label><label><span>새 GCS 객체 위치</span><input onChange={(event) => setDatasetUri(event.target.value)} placeholder="gs://bucket/versions/train-labeled-v1.csv" value={datasetUri} /></label><p className="dialog-help">기존 원본 CSV와 DB의 확정 라벨 거래를 합쳐 새 불변 객체를 생성합니다.</p><button className="admin-button primary" disabled={!datasetVersion || !datasetUri || isBusy} onClick={() => void createDataset()} type="button">데이터셋 생성</button></section></div>}
        {dialog === "training" && <div className="admin-dialog-backdrop" onMouseDown={() => setDialog(null)} role="presentation"><section aria-modal="true" className="admin-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog"><header><div><p className="admin-eyebrow">CLOUD RUN JOB</p><h2>학습 실행</h2></div><button onClick={() => setDialog(null)} type="button">닫기</button></header><label><span>학습 데이터셋</span><select onChange={(event) => setTrainingDatasetId(Number(event.target.value))} value={trainingDatasetId ?? ""}>{datasets.map((dataset) => <option key={dataset.id} value={dataset.id}>{dataset.version} · {dataset.row_count.toLocaleString("ko-KR")}행</option>)}</select></label><p className="dialog-help">학습은 비동기로 실행되며 완료 후 CANDIDATE 상태에서 MLflow 지표를 검토합니다.</p><button className="admin-button primary" disabled={!trainingDatasetId || isBusy} onClick={() => void launchTraining()} type="button">학습 시작</button></section></div>}
        {dialog === "promotion" && <div className="admin-dialog-backdrop" onMouseDown={() => setDialog(null)} role="presentation"><section aria-modal="true" className="admin-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog"><header><div><p className="admin-eyebrow">SERVING SMOKE</p><h2>후보 모델 예측 검증</h2></div><button onClick={() => setDialog(null)} type="button">닫기</button></header><label><span>거래 ID</span><input min="1" onChange={(event) => setTransactionId(event.target.value)} type="number" value={transactionId} /></label><label className="json-field"><span>같은 거래의 raw51 Feature JSON</span><textarea onChange={(event) => setPromotionJson(event.target.value)} spellCheck={false} value={promotionJson} /></label><button className="admin-button primary" disabled={!transactionId || isBusy} onClick={() => void promote()} type="button">검증 후 트래픽 전환</button></section></div>}
      </section>
    </AppLayout>
  );
}
