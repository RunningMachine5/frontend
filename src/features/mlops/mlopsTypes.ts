export type DatasetVersion = {
  id: number;
  version: string;
  gcs_uri: string;
  row_count: number;
  created_at: string;
  build?: {
    source_row_count: number;
    confirmed_label_count: number;
    appended_label_count: number;
  };
};

export type TrainingStatus =
  | "REQUESTED" | "RUNNING" | "CANDIDATE" | "REJECTED"
  | "STAGED" | "PROMOTING" | "PRODUCTION" | "FAILED" | "DEPLOYMENT_FAILED";

export type TrainingRun = {
  id: number;
  model_key: string;
  dataset_version_id: number;
  cloud_run_execution_name: string | null;
  mlflow_run_id: string | null;
  status: TrainingStatus;
  created_at: string;
  model_details: {
    source: "MLFLOW";
    run_id: string | null;
    details_endpoint: string | null;
  };
};

export type ModelDetails = {
  source: "MLFLOW";
  run_id: string;
  model_name: string;
  model_version: string;
  artifact_uri: string | null;
  metrics: Record<string, number>;
  params: Record<string, string>;
  tags: Record<string, string>;
};

export type ServingStatus = {
  name: string | null;
  uri: string | null;
  reconciling: boolean;
  latest_created_revision: string | null;
  latest_ready_revision: string | null;
  traffic: {
    type?: string;
    revision?: string;
    percent?: number;
    tag?: string;
    uri?: string;
  }[];
};

export type TrainingActionResult = {
  training_run: TrainingRun;
  operation_id?: string | null;
  model_version?: string;
};
