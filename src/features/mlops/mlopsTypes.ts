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
  error_message: string | null;
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

export type InferencePerformance = {
  window_minutes: number;
  inference_count: number;
  p95_latency_ms: number | null;
  latest_inference_at: string | null;
};

export type MonitoringPoint = {
  timestamp: string;
  value: number;
};

export type ServingMonitoring = {
  window_minutes: number;
  alignment_seconds: number;
  data_delay_seconds: number;
  service_name: string;
  region: string;
  queried_at: string;
  latest_sample_at: string | null;
  summary: {
    request_count: number;
    error_rate_percent: number;
    p95_latency_ms: number | null;
    active_instances: number | null;
    idle_instances: number | null;
    cpu_utilization_percent: number | null;
    memory_utilization_percent: number | null;
  };
  series: {
    requests_per_minute: MonitoringPoint[];
    error_rate_percent: MonitoringPoint[];
    p95_latency_ms: MonitoringPoint[];
    active_instances: MonitoringPoint[];
    cpu_utilization_percent: MonitoringPoint[];
    memory_utilization_percent: MonitoringPoint[];
  };
};

export type TrainingActionResult = {
  training_run: TrainingRun;
  operation_id?: string | null;
  model_version?: string;
};

export type TrainingReconcileResult = {
  training_run: TrainingRun;
  execution_outcome: string;
  execution: unknown;
};
