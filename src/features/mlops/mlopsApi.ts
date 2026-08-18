import { adminRequest } from "../admin/adminApi";
import type {
  DatasetVersion,
  ModelDetails,
  ServingStatus,
  TrainingActionResult,
  TrainingRun,
} from "./mlopsTypes";

export const fetchDatasets = () =>
  adminRequest<DatasetVersion[]>("/mlops/datasets");

export const buildDataset = (version: string, gcsUri: string) =>
  adminRequest<DatasetVersion>("/mlops/datasets/build", {
    method: "POST",
    body: JSON.stringify({ version, gcs_uri: gcsUri }),
  });

export const fetchTrainingRuns = () =>
  adminRequest<TrainingRun[]>("/mlops/training/runs");

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

export const promoteModel = (
  runId: number,
  transactionId: number,
  features: unknown,
) => adminRequest<TrainingActionResult>("/mlops/serving/promotions", {
  method: "POST",
  body: JSON.stringify({ training_run_id: runId, transaction_id: transactionId, features }),
});

export const completeDeployment = (runId: number, operationId: string) =>
  adminRequest<TrainingActionResult>(`/mlops/training/runs/${runId}/deployment/complete`, {
    method: "POST",
    body: JSON.stringify({ operation_id: operationId || null }),
  });
