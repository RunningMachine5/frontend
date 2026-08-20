// 모델 운영 화면이 사용하는 관리자 API 호출을 한곳에 모은다.

import { adminRequest } from "../admin/adminApi";
import type {
  DatasetPeriodSummary,
  DatasetVersion,
  InferencePerformance,
  ModelDetails,
  PlatformMonitoring,
  PlatformStatus,
  ServingStatus,
  ServingMonitoring,
  TrainingActionResult,
  TrainingExecution,
  TrainingMonitoring,
  TrainingReconcileResult,
  TrainingRun,
} from "./mlopsTypes";

export const fetchDatasets = () =>
  adminRequest<DatasetVersion[]>("/mlops/datasets");

const datasetPeriodBody = (periodStart: string, periodEnd: string) =>
  JSON.stringify({ period_start: periodStart, period_end: periodEnd });

export const fetchDatasetPreview = (periodStart: string, periodEnd: string) =>
  adminRequest<DatasetPeriodSummary>("/mlops/datasets/preview", {
    method: "POST",
    body: datasetPeriodBody(periodStart, periodEnd),
  });

export const buildDataset = (periodStart: string, periodEnd: string) =>
  adminRequest<DatasetVersion>("/mlops/datasets/build", {
    method: "POST",
    body: datasetPeriodBody(periodStart, periodEnd),
  });

export const deleteDataset = (datasetId: number) =>
  adminRequest<void>(`/mlops/datasets/${datasetId}`, {
    method: "DELETE",
  });

export const fetchTrainingRuns = () =>
  adminRequest<TrainingRun[]>("/mlops/training/runs");

export const fetchTrainingRun = (runId: number) =>
  adminRequest<TrainingRun>(`/mlops/training/runs/${runId}`);

export const fetchTrainingExecution = (runId: number) =>
  adminRequest<TrainingExecution>(`/mlops/training/runs/${runId}/execution`);

export const startTraining = (datasetId: number) =>
  adminRequest<TrainingActionResult>("/mlops/training/runs", {
    method: "POST",
    body: JSON.stringify({ dataset_version_id: datasetId, min_pr_auc: 0, min_recall: 0 }),
  });

export const fetchModelDetails = (runId: number) =>
  adminRequest<ModelDetails>(`/mlops/training/runs/${runId}/model-details`);

export const decideModel = (
  runId: number,
  decision: "APPROVE" | "REJECT",
  reason: string,
) => adminRequest<TrainingActionResult>(`/mlops/training/runs/${runId}/decision`, {
  method: "POST",
  body: JSON.stringify({ decision, reason: reason || null, restage: false }),
});

export const fetchServingStatus = () =>
  adminRequest<ServingStatus>("/mlops/serving/status");

export const fetchInferencePerformance = () =>
  adminRequest<InferencePerformance>("/mlops/serving/performance");

export const fetchServingMonitoring = (windowMinutes: number) =>
  adminRequest<ServingMonitoring>(
    `/mlops/serving/monitoring?window_minutes=${windowMinutes}`,
  );

export const fetchTrainingMonitoring = (windowMinutes: number) =>
  adminRequest<TrainingMonitoring>(
    `/mlops/training/monitoring?window_minutes=${windowMinutes}`,
  );

export const fetchPlatformStatus = () =>
  adminRequest<PlatformStatus>("/mlops/platform/status");

export const fetchPlatformMonitoring = (windowMinutes: number) =>
  adminRequest<PlatformMonitoring>(
    `/mlops/platform/monitoring?window_minutes=${windowMinutes}`,
  );

export const reconcileTrainingRun = (runId: number) =>
  adminRequest<TrainingReconcileResult>(`/mlops/training/runs/${runId}/reconcile`, {
    method: "POST",
  });

export const promoteModel = (
  runId: number,
  features: unknown,
) => adminRequest<TrainingActionResult>("/mlops/serving/promotions", {
  method: "POST",
  // 예측 요청에는 Feature만 사용됩니다. 기존 백엔드 요청 형식을 위해 Run ID를 식별값으로 보냅니다.
  body: JSON.stringify({ training_run_id: runId, transaction_id: runId, features }),
});

export const completeDeployment = (runId: number, operationId: string) =>
  adminRequest<TrainingActionResult>(`/mlops/training/runs/${runId}/deployment/complete`, {
    method: "POST",
    body: JSON.stringify({ operation_id: operationId || null }),
  });
