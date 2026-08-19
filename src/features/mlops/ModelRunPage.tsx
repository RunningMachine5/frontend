// 선택한 학습 Run의 지표 비교와 승인·배포 작업을 한 흐름으로 보여준다.

import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ModelPageShell } from "./components/ModelPageShell";
import {
  actionGuide,
  ACTIVE_RUN_STATUSES,
  COMPARISON_METRICS,
  formatDate,
  latestRevisionTraffic,
  metric,
  metricDeltaText,
  metricText,
  recommendationLabel,
  STATUS_LABELS,
  workflowForRun,
} from "./modelOperations";
import {
  completeDeployment,
  decideModel,
  fetchDatasets,
  fetchModelDetails,
  fetchServingStatus,
  fetchTrainingRun,
  fetchTrainingRuns,
  promoteModel,
  reconcileTrainingRun,
} from "./mlopsApi";
import type {
  DatasetVersion,
  ModelDetails,
  ServingStatus,
  TrainingRun,
} from "./mlopsTypes";

const RUN_REFRESH_MS = 5_000;

export function ModelRunPage() {
  const { runId: runIdParam } = useParams();
  const runId = Number(runIdParam);
  const [run, setRun] = useState<TrainingRun | null>(null);
  const [dataset, setDataset] = useState<DatasetVersion | null>(null);
  const [productionRun, setProductionRun] = useState<TrainingRun | null>(null);
  const [details, setDetails] = useState<ModelDetails | null>(null);
  const [productionDetails, setProductionDetails] = useState<ModelDetails | null>(null);
  const [serving, setServing] = useState<ServingStatus | null>(null);
  const [transactionId, setTransactionId] = useState("");
  const [featureJson, setFeatureJson] = useState("{}");
  const [operationId, setOperationId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const [runRow, runs, datasets, servingStatus] = await Promise.all([
        fetchTrainingRun(runId),
        fetchTrainingRuns(),
        fetchDatasets(),
        fetchServingStatus().catch(() => null),
      ]);
      const currentProduction = runs.find((item) => item.status === "PRODUCTION") ?? null;
      const selectedDetails = runRow.mlflow_run_id
        ? await fetchModelDetails(runRow.id).catch(() => null)
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
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Run 상세 정보를 불러오지 못했습니다.");
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    if (!run || !ACTIVE_RUN_STATUSES.has(run.status)) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, RUN_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load, run]);

  const runAction = async (action: () => Promise<string>) => {
    setIsBusy(true);
    setError(null);
    setNotice(null);
    try {
      setNotice(await action());
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다.");
    } finally {
      setIsBusy(false);
    }
  };

  const decide = (decision: "APPROVE" | "REJECT") => runAction(async () => {
    if (!run) return "";
    const reason = decision === "APPROVE"
      ? "관리자 화면에서 운영 모델과 후보 지표를 비교함"
      : "관리자 검토에서 후보를 거절함";
    await decideModel(run.id, decision, reason);
    return decision === "APPROVE"
      ? "후보 모델을 승인하고 0% 검증 단계로 이동했습니다."
      : "후보 모델을 거절했습니다.";
  });

  const promote = () => runAction(async () => {
    if (!run) return "";
    let features: unknown;
    try {
      features = JSON.parse(featureJson);
    } catch {
      throw new Error("Feature JSON 형식을 확인해 주세요.");
    }
    const result = await promoteModel(run.id, Number(transactionId), features);
    setOperationId(result.operation_id ?? "");
    return "후보 예측을 검증하고 운영 트래픽 전환을 요청했습니다.";
  });

  const complete = () => runAction(async () => {
    if (!run) return "";
    await completeDeployment(run.id, operationId);
    return "운영 전환과 MLflow 운영 alias 지정을 완료했습니다.";
  });

  const reconcile = () => runAction(async () => {
    if (!run) return "";
    const result = await reconcileTrainingRun(run.id);
    return `Cloud Run 실행 상태: ${result.execution_outcome}`;
  });

  const trafficPercent = latestRevisionTraffic(serving);
  const isCurrentProduction = run?.id === productionRun?.id;
  const workflow = run ? workflowForRun(run, trafficPercent) : [];
  const recommendation = recommendationLabel(details?.tags.promotion_recommendation);

  return (
    <ModelPageShell
      activeSection="training"
      actions={<Link className="admin-button" to="/models/training">학습 이력으로</Link>}
      description="한 Run의 학습 결과를 운영 모델과 비교하고 현재 단계의 작업만 진행합니다."
      title={run ? `Run #${run.id} 상세` : "Run 상세"}
    >
      {error && <div className="admin-alert error" role="alert">{error}</div>}
      {notice && <div className="admin-alert success" role="status">{notice}</div>}

      {!run && isLoading ? (
        <div aria-label="Run 상세 정보 로딩" className="run-detail-skeleton">
          <i /><i /><i />
        </div>
      ) : run ? (
        <>
          <header className="run-detail-header">
            <div className="run-detail-identity">
              <div>
                <p className="admin-eyebrow">SELECTED TRAINING RUN</p>
                <h2>Run #{run.id}{details?.model_version ? ` · model v${details.model_version}` : ""}</h2>
              </div>
              <em className={`status ${run.status.toLowerCase()}`}>{STATUS_LABELS[run.status]}</em>
            </div>
            <dl>
              <div><dt>데이터셋</dt><dd>{dataset?.version ?? `#${run.dataset_version_id}`}</dd></div>
              <div><dt>학습 요청</dt><dd>{formatDate(run.created_at)}</dd></div>
              <div><dt>MLflow Run</dt><dd title={run.mlflow_run_id ?? undefined}>{run.mlflow_run_id?.slice(0, 14) ?? "—"}</dd></div>
              <div><dt>추천</dt><dd>{recommendation}</dd></div>
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
                {details && <em className="recommendation">{recommendation}</em>}
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
                <h2>{STATUS_LABELS[run.status]}</h2>
                <p className="run-action-guide">{actionGuide(run, isCurrentProduction)}</p>
              </div>

              {run.error_message && <div className="run-error-message"><strong>실패 원인</strong><span>{run.error_message}</span></div>}

              {run.status === "CANDIDATE" && (
                <div className="run-action-buttons">
                  <button className="admin-button danger-button" disabled={isBusy} onClick={() => void decide("REJECT")} type="button">후보 거절</button>
                  <button className="admin-button primary" disabled={isBusy} onClick={() => void decide("APPROVE")} type="button">승인 후 0% 검증</button>
                </div>
              )}

              {["STAGED", "DEPLOYMENT_FAILED"].includes(run.status) && (
                <form className="run-smoke-form" onSubmit={(event) => { event.preventDefault(); void promote(); }}>
                  <label><span>검증 거래 ID</span><input min="1" onChange={(event) => setTransactionId(event.target.value)} required type="number" value={transactionId} /></label>
                  <label><span>같은 거래의 raw51 Feature JSON</span><textarea onChange={(event) => setFeatureJson(event.target.value)} required spellCheck={false} value={featureJson} /></label>
                  <button className="admin-button primary" disabled={isBusy} type="submit">검증 후 100% 전환</button>
                </form>
              )}

              {run.status === "PROMOTING" && (
                <div className="traffic-progress-card">
                  <div><span>Ready 리비전 트래픽</span><strong>{serving ? `${trafficPercent}%` : "확인 불가"}</strong></div>
                  <div className="traffic-progress-track"><i style={{ width: `${trafficPercent}%` }} /></div>
                  <p>Cloud Run 전환이 끝난 뒤 완료 확인을 누르면 운영 모델 상태와 MLflow alias를 확정합니다.</p>
                  <button className="admin-button primary" disabled={isBusy} onClick={() => void complete()} type="button">배포 완료 확인</button>
                </div>
              )}

              {["REQUESTED", "RUNNING"].includes(run.status) && (
                <button className="admin-button" disabled={isBusy} onClick={() => void reconcile()} type="button">Cloud Run 상태 확인</button>
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
