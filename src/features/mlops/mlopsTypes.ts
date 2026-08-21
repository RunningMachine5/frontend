// 모델 학습·배포·Serving 화면이 Backend와 주고받는 데이터 구조를 정의한다.

export type DatasetVersion = {
  id: number;
  version: string;
  gcs_uri: string;
  row_count: number;
  period_start: string | null;
  period_end: string | null;
  period_normal_count: number;
  period_fraud_count: number;
  created_at: string;
  build?: {
    source_row_count: number;
    confirmed_label_count: number;
    appended_label_count: number;
    normal_count: number;
    fraud_count: number;
  };
};

export type DatasetPeriodSummary = {
  base_period_start: string;
  base_period_end: string;
  period_start: string;
  period_end: string;
  labeled_count: number;
  normal_count: number;
  fraud_count: number;
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

export type ModelReview = {
  source: "AI";
  decision: "RECOMMENDED" | "NOT_RECOMMENDED";
  summary: string;
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
    p99_latency_ms: number | null;
    pending_p95_latency_ms: number | null;
    active_instances: number | null;
    idle_instances: number | null;
    cpu_utilization_percent: number | null;
    memory_utilization_percent: number | null;
  };
  series: {
    request_count: MonitoringPoint[];
    error_rate_percent: MonitoringPoint[];
    p95_latency_ms: MonitoringPoint[];
    p99_latency_ms: MonitoringPoint[];
    pending_p95_latency_ms: MonitoringPoint[];
    active_instances: MonitoringPoint[];
    cpu_utilization_percent: MonitoringPoint[];
    memory_utilization_percent: MonitoringPoint[];
  };
};

export type TrainingMonitoring = {
  window_minutes: number;
  alignment_seconds: number;
  data_delay_seconds: number;
  job_name: string;
  region: string;
  queried_at: string;
  latest_sample_at: string | null;
  summary: {
    running_executions: number | null;
    completed_executions: number;
    cpu_utilization_percent: number | null;
    memory_utilization_percent: number | null;
    billable_instance_seconds: number;
  };
  series: {
    running_executions: MonitoringPoint[];
    completed_executions: MonitoringPoint[];
    cpu_utilization_percent: MonitoringPoint[];
    memory_utilization_percent: MonitoringPoint[];
    billable_instance_seconds: MonitoringPoint[];
  };
};

export type TrainingExecution = {
  name: string;
  outcome: "RUNNING" | "SUCCEEDED" | "FAILED" | "UNKNOWN";
  create_time: string | null;
  start_time: string | null;
  completion_time: string | null;
  running_count: number;
  succeeded_count: number;
  failed_count: number;
  cancelled_count: number;
  retried_count: number;
  log_uri: string | null;
  failure_reason: string | null;
};

export type PlatformStatus = {
  backend_status: "UP";
  database_status: "UP" | "DOWN";
  database_latency_ms: number | null;
};

export type PlatformMonitoring = {
  window_minutes: number;
  alignment_seconds: number;
  data_delay_seconds: number;
  instance_id: string;
  instance_name: string;
  zone: string;
  queried_at: string;
  latest_sample_at: string | null;
  ops_agent_available: boolean;
  summary: {
    cpu_utilization_percent: number | null;
    memory_utilization_percent: number | null;
    disk_utilization_percent: number | null;
    network_received_kilobytes_per_second: number | null;
    network_sent_kilobytes_per_second: number | null;
    analysis_completed_count: number | null;
    normal_analysis_count: number | null;
    fraud_analysis_count: number | null;
  };
  series: {
    cpu_utilization_percent: MonitoringPoint[];
    memory_utilization_percent: MonitoringPoint[];
    disk_utilization_percent: MonitoringPoint[];
    network_received_kilobytes_per_second: MonitoringPoint[];
    network_sent_kilobytes_per_second: MonitoringPoint[];
    normal_analysis_count: MonitoringPoint[];
    fraud_analysis_count: MonitoringPoint[];
  };
  dependencies: {
    mlflow_latency_ms: number | null;
    https_certificate_expires_at: string | null;
    https_certificate_days_remaining: number | null;
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
