// 모델 운영 화면들이 함께 사용하는 상태 이름과 표시 형식을 모은다.

import type { ModelDetails, ServingStatus, TrainingRun } from "./mlopsTypes";

export const STATUS_LABELS: Record<string, string> = {
  REQUESTED: "요청됨",
  RUNNING: "학습 중",
  CANDIDATE: "검토 대기",
  REJECTED: "거절",
  STAGED: "운영 반영 준비",
  PROMOTING: "운영 반영 중",
  PRODUCTION: "운영 중",
  RETIRED: "이전 운영",
  FAILED: "학습 실패",
  DEPLOYMENT_FAILED: "운영 반영 실패",
};

export type TrainingDisplayStatus = TrainingRun["status"] | "RETIRED";

// 학습 이력 API는 최신 Run부터 반환하므로 첫 PRODUCTION을 현재 운영 Run으로 본다.
export function findCurrentProductionRun(runs: TrainingRun[]) {
  return runs.find((run) => run.status === "PRODUCTION") ?? null;
}

export function trainingDisplayStatus(
  run: TrainingRun,
  currentProductionRunId: number | null,
): TrainingDisplayStatus {
  if (
    run.status === "PRODUCTION"
    && currentProductionRunId !== null
    && run.id !== currentProductionRunId
  ) {
    return "RETIRED";
  }
  return run.status;
}

export const ACTION_REQUIRED_STATUSES = new Set([
  "CANDIDATE",
  "STAGED",
  "PROMOTING",
  "FAILED",
  "DEPLOYMENT_FAILED",
]);

const ACTION_LABELS: Record<string, string> = {
  CANDIDATE: "후보 모델 검토",
  STAGED: "운영 반영 준비",
  PROMOTING: "운영 모델 확정",
  FAILED: "학습 실패 원인 확인",
  DEPLOYMENT_FAILED: "운영 반영 실패 확인",
};

export function actionLabel(status: string) {
  return ACTION_LABELS[status] ?? "학습 상태 확인";
}

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

export function isModelRevisionReady(
  status: ServingStatus | null,
  modelVersion: string | undefined,
) {
  // 승인 직후에는 DB 상태만 STAGED이고 Cloud Run 리비전은 아직 생성 중일 수 있다.
  // 승인한 모델 tag가 최신 Ready 리비전을 가리킬 때만 검증 버튼을 연다.
  if (!status || status.reconciling || !modelVersion) return false;
  const latestCreated = resourceName(status.latest_created_revision);
  const latestReady = resourceName(status.latest_ready_revision);
  if (!latestCreated || latestCreated !== latestReady) return false;

  const modelTag = `model-v${modelVersion}`;
  return status.traffic.some((target) => {
    const revision = target.revision
      ? resourceName(target.revision)
      : target.type === "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
        ? latestCreated
        : null;
    return target.tag === modelTag
      && revision === latestCreated
      && (target.percent ?? 0) === 0;
  });
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

export function actionGuide(
  run: TrainingRun,
  isCurrentProduction: boolean,
  candidateReady = true,
) {
  switch (run.status) {
    case "CANDIDATE": return "운영 모델과 성능을 비교해 승인하거나 거절하세요. 승인해도 아직 운영에는 반영되지 않습니다.";
    case "STAGED": return candidateReady
      ? "운영 반영을 시작하면 최근 거래로 후보를 검증하고, 성공 시 운영 트래픽을 100% 전환합니다."
      : "승인한 후보를 운영에 영향이 없는 환경에서 준비하고 있습니다. 완료될 때까지 상태를 자동으로 확인합니다.";
    case "DEPLOYMENT_FAILED": return "실패 원인을 확인한 뒤 운영 반영을 다시 요청하세요.";
    case "PROMOTING": return "검증을 통과해 운영 트래픽을 전환하고 있습니다. 완료되면 운영 모델을 확정하세요.";
    case "PRODUCTION": return isCurrentProduction
      ? "새 모델이 현재 거래를 처리하고 있습니다."
      : "이전에 운영했던 모델입니다. 현재 운영 모델과 성능만 비교할 수 있습니다.";
    case "REJECTED": return "거절된 후보입니다. 다시 사용하려면 새 학습을 실행하세요.";
    case "REQUESTED": return "모델 학습 실행을 준비하고 있습니다.";
    case "RUNNING": return "모델 학습이 끝나면 성능 지표와 AI 판단을 확인할 수 있습니다.";
    default: return run.error_message ?? "실패 원인을 확인한 뒤 새 학습을 실행하세요.";
  }
}

export type WorkflowStep = {
  label: string;
  status: string;
  state: "complete" | "active" | "pending" | "error";
};

export function workflowForRun(
  run: TrainingRun,
  trafficPercent: number,
  candidateReady = true,
  isCurrentProduction = true,
): WorkflowStep[] {
  const reviewed = ["STAGED", "PROMOTING", "PRODUCTION", "DEPLOYMENT_FAILED"].includes(run.status);
  return [
    {
      label: "모델 학습",
      status: ["REQUESTED", "RUNNING"].includes(run.status)
        ? STATUS_LABELS[run.status]
        : run.status === "FAILED" ? "실패" : "완료",
      state: ["REQUESTED", "RUNNING"].includes(run.status)
        ? "active"
        : run.status === "FAILED" ? "error" : "complete",
    },
    {
      label: "후보 검토",
      status: run.status === "CANDIDATE"
        ? "검토 필요"
        : run.status === "REJECTED" ? "거절" : reviewed ? "승인" : "대기",
      state: run.status === "CANDIDATE"
        ? "active"
        : run.status === "REJECTED" ? "error" : reviewed ? "complete" : "pending",
    },
    {
      label: "운영 반영",
      status: run.status === "STAGED"
        ? (candidateReady ? "반영 가능" : "준비 중")
        : run.status === "PROMOTING"
          ? `${trafficPercent}% 반영 중`
          : run.status === "PRODUCTION"
            ? isCurrentProduction ? "운영 중" : "이전 운영"
            : run.status === "DEPLOYMENT_FAILED" ? "다시 확인" : "대기",
      state: ["STAGED", "PROMOTING"].includes(run.status)
        ? "active"
        : run.status === "PRODUCTION" ? "complete"
          : run.status === "DEPLOYMENT_FAILED" ? "error" : "pending",
    },
  ];
}
