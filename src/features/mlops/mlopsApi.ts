// 모델 운영 화면이 사용하는 관리자 API 호출을 한곳에 모은다.

import { adminRequest } from "../admin/adminApi";
import type {
  DatasetPeriodSummary,
  DatasetVersion,
  InferencePerformance,
  ModelDetails,
  ModelReview,
  ModelTransactionPage,
  ModelVersionSummary,
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

const MODEL_VERSIONS_CACHE_MS = 60_000;
let modelVersionsCache: { value: ModelVersionSummary[]; updatedAt: number } | null = null;
let modelVersionsRequest: Promise<ModelVersionSummary[]> | null = null;

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

export const prepareTrainingRun = (datasetId: number) =>
  adminRequest<TrainingRun>("/mlops/training/runs/prepare", {
    method: "POST",
    body: JSON.stringify({ dataset_version_id: datasetId }),
  });

export const executeTrainingRun = (runId: number) =>
  adminRequest<TrainingActionResult>(`/mlops/training/runs/${runId}/execute`, {
    method: "POST",
    body: JSON.stringify({ min_pr_auc: 0, min_recall: 0 }),
  });

export const fetchModelDetails = (runId: number) =>
  adminRequest<ModelDetails>(`/mlops/training/runs/${runId}/model-details`);

export const fetchModelReview = (runId: number) =>
  adminRequest<ModelReview>(`/mlops/training/runs/${runId}/ai-review`, {
    method: "POST",
  });

// 모델별 거래 통계 집계는 무거워서 세 모델 화면이 같은 60초 결과를 공유한다.
export async function fetchModelVersions(force = false) {
  if (
    !force
    && modelVersionsCache
    && Date.now() - modelVersionsCache.updatedAt < MODEL_VERSIONS_CACHE_MS
  ) {
    return modelVersionsCache.value;
  }
  if (modelVersionsRequest) return modelVersionsRequest;

  modelVersionsRequest = adminRequest<ModelVersionSummary[]>("/mlops/models")
    .then((value) => {
      modelVersionsCache = { value, updatedAt: Date.now() };
      return value;
    });
  try {
    return await modelVersionsRequest;
  } finally {
    modelVersionsRequest = null;
  }
}

function clearModelVersionsCache() {
  modelVersionsCache = null;
}

export const fetchModelTransactions = (
  runId: number,
  labelFilter: "ALL" | "LABELED" | "MISMATCH",
  page: number,
  pageSize = 10,
) => adminRequest<ModelTransactionPage>(
  `/mlops/models/${runId}/transactions?label_filter=${labelFilter}&page=${page}&page_size=${pageSize}`,
);

export const decideModel = (
  runId: number,
  decision: "APPROVE" | "REJECT",
  reason: string,
) => adminRequest<TrainingActionResult>(`/mlops/training/runs/${runId}/decision`, {
  method: "POST",
  body: JSON.stringify({ decision, reason: reason || null, restage: false }),
}).then((result) => {
  clearModelVersionsCache();
  return result;
});

export const reactivateModel = (runId: number) =>
  adminRequest<TrainingActionResult>(`/mlops/training/runs/${runId}/reactivate`, {
    method: "POST",
  }).then((result) => {
    clearModelVersionsCache();
    return result;
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

export const promoteModel = (runId: number) =>
  adminRequest<TrainingActionResult>("/mlops/serving/promotions", {
  method: "POST",
  body: JSON.stringify({ training_run_id: runId }),
}).then((result) => {
  clearModelVersionsCache();
  return result;
});

export const completeDeployment = (runId: number, operationId: string) =>
  adminRequest<TrainingActionResult>(`/mlops/training/runs/${runId}/deployment/complete`, {
    method: "POST",
    body: JSON.stringify({ operation_id: operationId || null }),
  }).then((result) => {
    clearModelVersionsCache();
    return result;
  });
