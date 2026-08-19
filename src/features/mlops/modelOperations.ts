// 모델 운영 화면들이 함께 사용하는 상태 이름과 표시 형식을 모은다.

import type { ModelDetails, ServingStatus, TrainingRun } from "./mlopsTypes";

export const STATUS_LABELS: Record<string, string> = {
  REQUESTED: "요청됨",
  RUNNING: "학습 중",
  CANDIDATE: "검토 대기",
  REJECTED: "거절",
  STAGED: "0% 검증",
  PROMOTING: "전환 중",
  PRODUCTION: "운영 중",
  FAILED: "학습 실패",
  DEPLOYMENT_FAILED: "배포 실패",
};

export const ACTION_REQUIRED_STATUSES = new Set([
  "CANDIDATE",
  "STAGED",
  "PROMOTING",
  "FAILED",
  "DEPLOYMENT_FAILED",
]);

export const ACTIVE_RUN_STATUSES = new Set(["REQUESTED", "RUNNING", "PROMOTING"]);

export const COMPARISON_METRICS = [
  { label: "PR-AUC", keys: ["validation_pr_auc"], lowerIsBetter: false },
  { label: "ROC-AUC", keys: ["validation_roc_auc"], lowerIsBetter: false },
  { label: "Recall", keys: ["validation_recall"], lowerIsBetter: false },
  { label: "F1 Score", keys: ["validation_f1"], lowerIsBetter: false },
  { label: "Precision", keys: ["validation_precision"], lowerIsBetter: false },
  { label: "FPR", keys: ["validation_fpr"], lowerIsBetter: true },
] as const;

export function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatClock(value: string | Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

export function resourceName(value: string | null | undefined) {
  return value?.split("/").at(-1) ?? null;
}

export function latestRevisionTraffic(status: ServingStatus | null) {
  if (!status) return 0;
  const latestReadyRevision = resourceName(status.latest_ready_revision);
  if (!latestReadyRevision) return 0;
  const percent = status.traffic.reduce((sum, target) => {
    const revision = target.revision
      ? resourceName(target.revision)
      : target.type === "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
        ? resourceName(status.latest_created_revision)
        : null;
    return revision === latestReadyRevision ? sum + (target.percent ?? 0) : sum;
  }, 0);
  return Math.min(100, Math.max(0, percent));
}

export function metric(details: ModelDetails | null, ...keys: string[]) {
  for (const key of keys) {
    if (details?.metrics[key] !== undefined) return details.metrics[key];
  }
  return null;
}

export function metricText(value: number | null) {
  return value === null ? "—" : value.toFixed(4);
}

export function metricDeltaText(value: number | null) {
  if (value === null) return "—";
  if (value === 0) return "0.0000";
  return `${value > 0 ? "+" : ""}${value.toFixed(4)}`;
}

export function recommendationLabel(value: string | undefined) {
  if (value === "RECOMMENDED") return "승격 추천";
  if (value === "NOT_RECOMMENDED") return "승격 비추천";
  return "추천 정보 없음";
}

export function actionGuide(run: TrainingRun, isCurrentProduction: boolean) {
  switch (run.status) {
    case "CANDIDATE": return "운영 모델과 지표를 비교한 뒤 승인하거나 거절하세요.";
    case "STAGED": return "0% 후보 리비전이 준비됐습니다. 실제 거래로 예측을 검증하세요.";
    case "DEPLOYMENT_FAILED": return "실패 원인을 확인한 뒤 예측 검증과 전환을 다시 요청하세요.";
    case "PROMOTING": return "Cloud Run 트래픽 전환이 끝나면 배포 완료를 확인하세요.";
    case "PRODUCTION": return isCurrentProduction
      ? "현재 운영 트래픽을 처리하는 모델입니다."
      : "이전에 운영했던 모델입니다. 현재 운영 모델과 성능만 비교할 수 있습니다.";
    case "REJECTED": return "거절된 후보입니다. 다시 사용하려면 새 학습을 실행하세요.";
    case "REQUESTED": return "Cloud Run이 학습 실행을 접수하는 중입니다.";
    case "RUNNING": return "학습과 MLflow 등록이 끝나면 후보 검토 단계로 이동합니다.";
    default: return run.error_message ?? "실패 원인을 확인한 뒤 새 학습을 실행하세요.";
  }
}

export type WorkflowStep = {
  label: string;
  status: string;
  state: "complete" | "active" | "pending" | "error";
};

export function workflowForRun(run: TrainingRun, trafficPercent: number): WorkflowStep[] {
  const reviewed = ["STAGED", "PROMOTING", "PRODUCTION"].includes(run.status);
  const verified = ["PROMOTING", "PRODUCTION"].includes(run.status);
  return [
    { label: "데이터셋 준비", status: "완료", state: "complete" },
    {
      label: "Cloud Run 학습",
      status: ["REQUESTED", "RUNNING"].includes(run.status)
        ? STATUS_LABELS[run.status]
        : run.status === "FAILED" ? "실패" : "완료",
      state: ["REQUESTED", "RUNNING"].includes(run.status)
        ? "active"
        : run.status === "FAILED" ? "error" : "complete",
    },
    {
      label: "지표 검토",
      status: run.status === "CANDIDATE"
        ? "검토 필요"
        : run.status === "REJECTED" ? "거절" : reviewed ? "승인" : "대기",
      state: run.status === "CANDIDATE"
        ? "active"
        : run.status === "REJECTED" ? "error" : reviewed ? "complete" : "pending",
    },
    {
      label: "0% 후보 검증",
      status: run.status === "STAGED"
        ? "검증 필요"
        : run.status === "DEPLOYMENT_FAILED" ? "재시도" : verified ? "통과" : "대기",
      state: run.status === "STAGED"
        ? "active"
        : run.status === "DEPLOYMENT_FAILED" ? "error" : verified ? "complete" : "pending",
    },
    {
      label: "운영 전환",
      status: run.status === "PROMOTING"
        ? `${trafficPercent}% 전환 중`
        : run.status === "PRODUCTION" ? "100% 운영" : "대기",
      state: run.status === "PROMOTING"
        ? "active"
        : run.status === "PRODUCTION" ? "complete"
          : run.status === "DEPLOYMENT_FAILED" ? "error" : "pending",
    },
  ];
}
