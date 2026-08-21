// 선택한 학습 Run의 지표 비교와 승인·배포 작업을 한 흐름으로 보여준다.

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { AdminAlert } from "../admin/AdminAlert";
import {
  ModelLoadingStatus,
  type ModelLoadingStatusProps,
} from "./components/ModelLoadingStatus";
import { ModelPageShell } from "./components/ModelPageShell";
import {
  actionGuide,
  ACTIVE_RUN_STATUSES,
  COMPARISON_METRICS,
  findCurrentProductionRun,
  formatClock,
  formatDate,
  isModelRevisionReady,
  latestRevisionTraffic,
  metric,
  metricDeltaText,
  metricText,
  STATUS_LABELS,
  trainingDisplayStatus,
  workflowForRun,
} from "./modelOperations";
import {
  completeDeployment,
  decideModel,
  executeTrainingRun,
  fetchDatasets,
  fetchModelDetails,
  fetchModelReview,
  fetchServingStatus,
  fetchTrainingExecution,
  fetchTrainingRun,
  fetchTrainingRuns,
  promoteModel,
  reconcileTrainingRun,
} from "./mlopsApi";
import type {
  DatasetVersion,
  ModelDetails,
  ModelReview,
  ServingStatus,
  TrainingExecution,
  TrainingRun,
} from "./mlopsTypes";

const RUN_REFRESH_MS = 5_000;

export function ModelRunPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { runId: runIdParam } = useParams();
  const runId = Number(runIdParam);
  const executeOnOpen = Boolean(
    (location.state as { executeTraining?: boolean } | null)?.executeTraining,
  );
  const executionRequestStarted = useRef(false);
  const reviewRequestedRunId = useRef<number | null>(null);
  const [run, setRun] = useState<TrainingRun | null>(null);
  const [dataset, setDataset] = useState<DatasetVersion | null>(null);
  const [productionRun, setProductionRun] = useState<TrainingRun | null>(null);
  const [details, setDetails] = useState<ModelDetails | null>(null);
  const [productionDetails, setProductionDetails] = useState<ModelDetails | null>(null);
  const [modelReview, setModelReview] = useState<ModelReview | null>(null);
  const [modelReviewError, setModelReviewError] = useState<string | null>(null);
  const [isModelReviewLoading, setIsModelReviewLoading] = useState(false);
  const [serving, setServing] = useState<ServingStatus | null>(null);
  const [execution, setExecution] = useState<TrainingExecution | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [operationId, setOperationId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [busyActivity, setBusyActivity] = useState<ModelLoadingStatusProps | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const candidateReady = isModelRevisionReady(serving, details?.model_version);
  const isCandidatePreparing = run?.status === "STAGED" && !candidateReady;

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const [runRow, runs, datasets, servingStatus] = await Promise.all([
        fetchTrainingRun(runId),
        fetchTrainingRuns(),
        fetchDatasets(),
        fetchServingStatus().catch(() => null),
      ]);
      const currentProduction = findCurrentProductionRun(runs);
      const selectedDetails = runRow.mlflow_run_id
        ? await fetchModelDetails(runRow.id).catch(() => null)
        : null;
      const selectedExecution = runRow.status === "RUNNING" && runRow.cloud_run_execution_name
        ? await fetchTrainingExecution(runRow.id).catch(() => null)
        : null;
      const currentProductionDetails = currentProduction?.mlflow_run_id
        ? currentProduction.id === runRow.id
          ? selectedDetails
          : await fetchModelDetails(currentProduction.id).catch(() => null)
        : null;

      setRun(runRow);
      setDataset(datasets.find((item) => item.id === runRow.dataset_version_id) ?? null);
      setProductionRun(currentProduction);
      setDetails(selectedDetails);
      setProductionDetails(currentProductionDetails);
      setServing(servingStatus);
      setExecution(selectedExecution);
      setLastRefreshedAt(new Date());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Run 상세 정보를 불러오지 못했습니다.");
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [runId]);

  const requestExecution = useCallback(async (selectedRunId: number) => {
    setIsBusy(true);
    setBusyActivity({
      description: "요청이 접수되면 Run 상태가 자동으로 갱신됩니다.",
      label: "CLOUD RUN JOB",
      title: `Run #${selectedRunId} 학습 요청을 전달하고 있습니다`,
    });
    setError(null);
    setNotice(null);
    try {
      const result = await executeTrainingRun(selectedRunId);
      setOperationId(result.operation_id ?? "");
      await load();
      setNotice("Cloud Run 학습 실행을 요청했습니다.");
    } catch (cause) {
      await load();
      setError(cause instanceof Error ? cause.message : "학습 실행을 요청하지 못했습니다.");
    } finally {
      setIsBusy(false);
      setBusyActivity(null);
    }
  }, [load]);

  const requestModelReview = useCallback(async (selectedRunId: number) => {
    setIsModelReviewLoading(true);
    setModelReviewError(null);
    try {
      setModelReview(await fetchModelReview(selectedRunId));
    } catch (cause) {
      setModelReview(null);
      setModelReviewError(
        cause instanceof Error
          ? cause.message
          : "AI 판단을 불러오지 못했습니다.",
      );
    } finally {
      setIsModelReviewLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    setModelReview(null);
    setModelReviewError(null);
    setIsModelReviewLoading(false);
  }, [runId]);

  useEffect(() => {
    if (
      run?.status !== "CANDIDATE"
      || !details
      || reviewRequestedRunId.current === run.id
    ) return;

    reviewRequestedRunId.current = run.id;
    void requestModelReview(run.id);
  }, [details, requestModelReview, run]);

  useEffect(() => {
    if (
      !executeOnOpen
      || !run
      || run.status !== "REQUESTED"
      || executionRequestStarted.current
    ) return;

    executionRequestStarted.current = true;
    navigate(location.pathname, { replace: true, state: null });
    void requestExecution(run.id);
  }, [executeOnOpen, location.pathname, navigate, requestExecution, run]);

  useEffect(() => {
    const shouldRefresh = run && (
      ACTIVE_RUN_STATUSES.has(run.status)
      || isCandidatePreparing
    );
    if (!shouldRefresh) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, RUN_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [isCandidatePreparing, load, run]);

  const runAction = async (
    activity: ModelLoadingStatusProps,
    action: () => Promise<string>,
  ) => {
    setIsBusy(true);
    setBusyActivity(activity);
    setError(null);
    setNotice(null);
    try {
      setNotice(await action());
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다.");
    } finally {
      setIsBusy(false);
      setBusyActivity(null);
    }
  };

  const decide = (decision: "APPROVE" | "REJECT") => runAction({
    description: "검토 결과와 변경 사유를 저장하고 다음 운영 단계를 준비합니다.",
    label: "MODEL REVIEW",
    title: decision === "APPROVE" ? "후보 모델을 승인하고 있습니다" : "후보 모델을 거절하고 있습니다",
  }, async () => {
    if (!run) return "";
    if (decision === "REJECT" && !window.confirm(`Run #${run.id} 후보를 거절할까요?`)) {
      return "후보 검토를 계속할 수 있습니다.";
    }
    const reason = decision === "APPROVE"
      ? "관리자 화면에서 운영 모델과 후보 지표를 비교함"
      : "관리자 검토에서 후보를 거절함";
    await decideModel(run.id, decision, reason);
    return decision === "APPROVE"
      ? "후보 모델을 승인하고 운영 전 검증 준비를 요청했습니다."
      : "후보 모델을 거절했습니다.";
  });

  const promote = () => runAction({
    description: "최근 거래로 후보 모델을 검증한 뒤 운영 트래픽 전환을 요청합니다.",
    label: "MODEL PROMOTION",
    title: "후보 모델을 검증하고 있습니다",
  }, async () => {
    if (!run) return "";
    const result = await promoteModel(run.id);
    setOperationId(result.operation_id ?? "");
    return "후보 예측을 검증하고 운영 트래픽 전환을 요청했습니다.";
  });

  const complete = () => runAction({
    description: "Cloud Run 트래픽과 MLflow 운영 alias를 최종 확정합니다.",
    label: "PRODUCTION SYNC",
    title: "운영 전환을 확정하고 있습니다",
  }, async () => {
    if (!run) return "";
    await completeDeployment(run.id, operationId);
    return "운영 전환과 MLflow 운영 alias 지정을 완료했습니다.";
  });

  const reconcile = () => runAction({
    description: "Cloud Run 실행 결과와 저장된 Run 상태를 맞춥니다.",
    label: "CLOUD RUN",
    title: `Run #${run?.id ?? ""} 실행 상태를 확인하고 있습니다`,
  }, async () => {
    if (!run) return "";
    const result = await reconcileTrainingRun(run.id);
    return `Cloud Run 실행 상태: ${result.execution_outcome}`;
  });

  const trafficPercent = latestRevisionTraffic(serving);
  const isCurrentProduction = run?.id === productionRun?.id;
  const displayStatus = run
    ? trainingDisplayStatus(run, productionRun?.id ?? null)
    : null;
  const workflow = run
    ? workflowForRun(run, trafficPercent, candidateReady, isCurrentProduction)
    : [];
  const recommendation = recommendationLabel(details?.tags.promotion_recommendation);
  const trainingPhase = run?.status !== "RUNNING"
    ? null
    : execution?.outcome === "FAILED"
      ? "failed"
      : execution?.outcome === "SUCCEEDED"
        ? "syncing"
        : !run.cloud_run_execution_name
          ? "connecting"
          : !execution?.start_time
            ? "starting"
            : "training";
  const trainingActionTitle = trainingPhase === "failed"
    ? "학습 실행 확인 필요"
    : trainingPhase === "syncing"
      ? "학습 결과 연결 중"
      : trainingPhase === "connecting"
        ? "실행 환경 연결 중"
        : trainingPhase === "starting"
          ? "학습 컨테이너 시작 중"
          : "모델 학습 중";
  const trainingActionGuide = trainingPhase === "failed"
    ? "Cloud Run에서 실패가 감지됐습니다. 상태를 확인해 Run에 반영하세요."
    : trainingPhase === "syncing"
      ? "학습은 끝났으며 MLflow 결과가 Run에 연결되기를 기다리고 있습니다."
      : trainingPhase === "connecting"
        ? "Cloud Run에서 학습 실행을 준비하고 있습니다. 상태는 자동으로 갱신됩니다."
        : trainingPhase === "starting"
          ? "실행 연결을 마쳤으며 학습 컨테이너가 시작되기를 기다리고 있습니다."
          : "모델 학습과 MLflow 등록이 진행 중입니다.";
  const modelReviewLabel = modelReview?.decision === "RECOMMENDED"
    ? "승격 추천"
    : modelReview?.decision === "NOT_RECOMMENDED"
      ? "승격 비추천"
      : isModelReviewLoading
        ? "판단 중…"
        : modelReviewError
          ? "판단 불가"
          : run?.status === "CANDIDATE"
            ? "판단 준비"
            : isCurrentProduction
              ? "운영 기준"
              : "해당 없음";
  const modelReviewTone = modelReview?.decision === "RECOMMENDED"
    ? "recommended"
    : modelReview?.decision === "NOT_RECOMMENDED"
      ? "not-recommended"
    : "pending";

  return (
    <ModelPageShell
      activeSection="training"
      actions={<Link className="admin-button" to="/models/training">학습 이력으로</Link>}
    >
      {error && <AdminAlert message={error} onDismiss={() => setError(null)} tone="error" />}
      {notice && <AdminAlert message={notice} onDismiss={() => setNotice(null)} tone="success" />}
      {busyActivity && <ModelLoadingStatus {...busyActivity} />}

      {!run && isLoading ? (
        <>
          <ModelLoadingStatus
            description="Run 상태, 데이터셋, 운영 모델과 Serving 정보를 함께 확인합니다."
            label="RUN DETAIL"
            title="학습 Run 상세 정보를 불러오고 있습니다"
          />
          <div aria-label="Run 상세 정보 로딩" className="run-detail-skeleton">
            <i /><i /><i />
          </div>
        </>
      ) : run ? (
        <>
          <header className="run-detail-header">
            <div className="run-detail-identity">
              <div>
                <p className="admin-eyebrow">SELECTED TRAINING RUN</p>
                <h2>Run #{run.id}{details?.model_version ? ` · model v${details.model_version}` : ""}</h2>
              </div>
              <em className={`status ${displayStatus?.toLowerCase()}`}>{displayStatus && STATUS_LABELS[displayStatus]}</em>
            </div>
            <dl>
              <div><dt>데이터셋</dt><dd>{dataset?.version ?? `#${run.dataset_version_id}`}</dd></div>
              <div><dt>학습 요청</dt><dd>{formatDate(run.created_at)}</dd></div>
              <div><dt>MLflow Run</dt><dd title={run.mlflow_run_id ?? undefined}>{run.mlflow_run_id?.slice(0, 14) ?? "—"}</dd></div>
              <div><dt>AI 판단</dt><dd className={modelReviewTone}>{modelReviewLabel}</dd></div>
            </dl>
          </header>

          <ol aria-label={`Run ${run.id} 모델 운영 5단계`} className="workflow-rail run-workflow-rail">
            {workflow.map((step, index) => (
              <li className={`workflow-step ${step.state}`} key={step.label}>
                <small>0{index + 1}</small>
                <div><strong>{step.label}</strong><span>{step.status}</span></div>
              </li>
            ))}
          </ol>

          <section className="run-detail-workspace">
            <article className="admin-panel run-comparison-panel">
              <div className="panel-title split">
                <div>
                  <p className="admin-eyebrow">MODEL COMPARISON</p>
                  <h2>후보 성능 비교</h2>
                  <small>{isCurrentProduction ? "현재 운영 모델의 기준 성능입니다." : "현재 운영 모델과 같은 검증 지표로 비교합니다."}</small>
                </div>
                {details && (
                  <em className={`recommendation ${modelReviewTone}`}>
                    {run.status === "CANDIDATE"
                      ? `AI 판단 · ${modelReviewLabel}`
                      : modelReviewLabel}
                  </em>
                )}
              </div>
              <div aria-label="선택 모델과 운영 모델 성능 비교" className="model-comparison" role="table">
                <div className="model-comparison-row model-comparison-header" role="row">
                  <span role="columnheader">성능 지표</span><span role="columnheader">선택 Run</span><span role="columnheader">운영 모델</span><span role="columnheader">차이</span>
                </div>
                {COMPARISON_METRICS.map(({ label, keys, lowerIsBetter }) => {
                  const selectedValue = metric(details, ...keys);
                  const productionValue = metric(productionDetails, ...keys);
                  const delta = selectedValue !== null && productionValue !== null
                    ? selectedValue - productionValue
                    : null;
                  const deltaTone = delta === null || delta === 0
                    ? "same"
                    : (lowerIsBetter ? delta < 0 : delta > 0) ? "better" : "worse";
                  return (
                    <div className="model-comparison-row" key={label} role="row">
                      <strong role="cell">{label}<small>{lowerIsBetter ? "낮을수록 좋음" : "높을수록 좋음"}</small></strong>
                      <span role="cell">{metricText(selectedValue)}</span>
                      <span role="cell">{metricText(productionValue)}</span>
                      <em className={deltaTone} role="cell">{isCurrentProduction && delta !== null ? "기준" : metricDeltaText(delta)}</em>
                    </div>
                  );
                })}
              </div>
            </article>

            <aside className="admin-panel run-action-panel">
              <div>
                <p className="admin-eyebrow">CURRENT ACTION</p>
                <h2>{run.status === "RUNNING" ? trainingActionTitle : isCandidatePreparing ? "검증 후보 준비 중" : displayStatus && STATUS_LABELS[displayStatus]}</h2>
                <p className="run-action-guide">{run.status === "RUNNING" ? trainingActionGuide : actionGuide(run, isCurrentProduction, candidateReady)}</p>
              </div>

              {run.error_message && <div className="run-error-message"><strong>실패 원인</strong><span>{run.error_message}</span></div>}

              {run.status === "CANDIDATE" && (
                <>
                  <section
                    aria-live="polite"
                    className={`model-ai-review ${modelReviewTone}`}
                  >
                    <header>
                      <span>AI 판단 근거</span>
                      <em>{modelReviewLabel}</em>
                    </header>
                    {isModelReviewLoading ? (
                      <div className="model-ai-review-loading">
                        <i aria-hidden="true" />
                        <p>후보와 운영 모델의 성능 차이를 검토하고 있습니다.</p>
                      </div>
                    ) : modelReview ? (
                      <p>{modelReview.summary}</p>
                    ) : (
                      <div className="model-ai-review-error">
                        <p>AI 판단을 불러오지 못했습니다. 성능 지표를 직접 확인하거나 다시 요청해 주세요.</p>
                        <button
                          onClick={() => void requestModelReview(run.id)}
                          type="button"
                        >
                          다시 판단
                        </button>
                      </div>
                    )}
                  </section>
                  <div className="run-action-buttons">
                    <button className="admin-button danger-button" disabled={isBusy} onClick={() => void decide("REJECT")} type="button">후보 거절</button>
                    <button className="admin-button primary" disabled={isBusy} onClick={() => void decide("APPROVE")} type="button">검증 후보로 승인</button>
                  </div>
                </>
              )}

              {["STAGED", "DEPLOYMENT_FAILED"].includes(run.status) && (
                <div className="automatic-smoke-card">
                  <div>
                    <span>{isCandidatePreparing ? "검증 후보 준비 중" : "자동 검증 준비 완료"}</span>
                    <strong>{isCandidatePreparing ? "새 모델을 추론 서버에 준비하고 있습니다." : "저장된 최근 거래로 후보 모델을 검증합니다."}</strong>
                    <p>{isCandidatePreparing ? "준비 상태는 자동으로 확인합니다. 입력할 값은 없습니다." : "거래와 검증 데이터는 서버가 자동으로 선택합니다."}</p>
                  </div>
                  <button className="admin-button primary" disabled={isBusy || isCandidatePreparing} onClick={() => void promote()} type="button">
                    {isCandidatePreparing ? "검증 후보 준비 중…" : "자동 검증 후 100% 전환"}
                  </button>
                </div>
              )}

              {run.status === "PROMOTING" && (
                <div className="traffic-progress-card">
                  <div><span>Ready 리비전 트래픽</span><strong>{serving ? `${trafficPercent}%` : "확인 불가"}</strong></div>
                  <div className="traffic-progress-track"><i style={{ width: `${trafficPercent}%` }} /></div>
                  <p>Cloud Run 전환이 끝난 뒤 완료 확인을 누르면 운영 모델 상태와 MLflow alias를 확정합니다.</p>
                  <button className="admin-button primary" disabled={isBusy} onClick={() => void complete()} type="button">배포 완료 확인</button>
                </div>
              )}

              {run.status === "REQUESTED" && (
                <button
                  className="admin-button primary"
                  disabled={isBusy}
                  onClick={() => void requestExecution(run.id)}
                  type="button"
                >
                  {isBusy ? "학습 요청 중…" : "Cloud Run 학습 시작"}
                </button>
              )}

              {run.status === "RUNNING" && (
                <div className={`training-progress-card ${trainingPhase ?? "connecting"}`}>
                  <div aria-live="polite" className="training-progress-summary">
                    <span aria-hidden="true" className="training-progress-signal" />
                    <div>
                      <span>{trainingActionTitle}</span>
                      <strong>{run.cloud_run_execution_name ?? "Cloud Run 실행 확인 중"}</strong>
                    </div>
                  </div>

                  <div aria-hidden="true" className="training-progress-track"><i /></div>

                  <div className="training-progress-log">
                    <header><strong>진행 로그</strong><small>실제 상태 기준</small></header>
                    <ol>
                      <li className="complete">
                        <time>{formatClock(run.created_at)}</time><i aria-hidden="true" />
                        <span>학습 요청을 접수했습니다.</span>
                      </li>
                      <li className={run.cloud_run_execution_name ? "complete" : "active"}>
                        <time>{execution?.create_time ? formatClock(execution.create_time) : run.cloud_run_execution_name ? "확인됨" : "현재"}</time><i aria-hidden="true" />
                        <span>{run.cloud_run_execution_name ? "Cloud Run 실행 연결을 확인했습니다." : "Cloud Run 실행 연결을 기다리고 있습니다."}</span>
                      </li>
                      <li className={trainingPhase === "failed" ? "error" : trainingPhase === "syncing" ? "complete" : trainingPhase === "training" ? "active" : "pending"}>
                        <time>{execution?.start_time ? formatClock(execution.start_time) : "대기"}</time><i aria-hidden="true" />
                        <span>{trainingPhase === "failed"
                          ? execution?.failure_reason ?? "Cloud Run 학습 실행이 실패했습니다."
                          : trainingPhase === "syncing"
                            ? "모델 학습을 마치고 결과를 연결하고 있습니다."
                            : trainingPhase === "training"
                              ? "모델 학습과 MLflow 등록을 진행하고 있습니다."
                              : "실행이 준비되면 모델 학습을 시작합니다."}</span>
                      </li>
                    </ol>
                  </div>

                  <footer className="training-progress-footer">
                    <span>5초마다 자동 갱신 · 마지막 확인 {formatClock(lastRefreshedAt)}</span>
                    {run.cloud_run_execution_name && (
                      <button className="admin-button compact" disabled={isBusy} onClick={() => void reconcile()} type="button">상태 즉시 확인</button>
                    )}
                  </footer>
                </div>
              )}
            </aside>
          </section>
        </>
      ) : (
        <div className="model-empty-state"><strong>Run 정보를 확인하지 못했습니다.</strong><span>학습 이력에서 다시 선택해 주세요.</span></div>
      )}
    </ModelPageShell>
  );
}
