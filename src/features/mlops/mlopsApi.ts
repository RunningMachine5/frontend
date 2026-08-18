import { adminRequest } from "../admin/adminApi";
import type {
  DatasetVersion,
  ModelDetails,
  ServingStatus,
  TrainingActionResult,
  TrainingRun,
} from "./mlopsTypes";

export const fetchDatasets = (token: string) =>
  adminRequest<DatasetVersion[]>("/mlops/datasets", token);

export const buildDataset = (token: string, version: string, gcsUri: string) =>
  adminRequest<DatasetVersion>("/mlops/datasets/build", token, {
    method: "POST",
    body: JSON.stringify({ version, gcs_uri: gcsUri }),
  });

export const fetchTrainingRuns = (token: string) =>
  adminRequest<TrainingRun[]>("/mlops/training/runs", token);

export const startTraining = (token: string, datasetId: number) =>
  adminRequest<TrainingActionResult>("/mlops/training/runs", token, {
    method: "POST",
    body: JSON.stringify({ dataset_version_id: datasetId, min_pr_auc: 0, min_recall: 0 }),
  });

export const fetchModelDetails = (token: string, runId: number) =>
  adminRequest<ModelDetails>(`/mlops/training/runs/${runId}/model-details`, token);

export const decideModel = (
  token: string,
  runId: number,
  decision: "APPROVE" | "REJECT",
  reason: string,
) => adminRequest<TrainingActionResult>(`/mlops/training/runs/${runId}/decision`, token, {
  method: "POST",
  body: JSON.stringify({ decision, reason: reason || null, restage: false }),
});

export const fetchServingStatus = (token: string) =>
  adminRequest<ServingStatus>("/mlops/serving/status", token);

export const promoteModel = (
  token: string,
  runId: number,
  transactionId: number,
  features: unknown,
) => adminRequest<TrainingActionResult>("/mlops/serving/promotions", token, {
  method: "POST",
  body: JSON.stringify({ training_run_id: runId, transaction_id: transactionId, features }),
});

export const completeDeployment = (token: string, runId: number, operationId: string) =>
  adminRequest<TrainingActionResult>(`/mlops/training/runs/${runId}/deployment/complete`, token, {
    method: "POST",
    body: JSON.stringify({ operation_id: operationId || null }),
  });
