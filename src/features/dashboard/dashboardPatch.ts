import type {
  DashboardOverviewPeriod,
  DashboardOverviewResponse,
  DistributionItem,
  RecentTransaction,
} from "./dashboardOverviewTypes";
import type { CaseListItem } from "../queue/queueTypes";

export type DashboardTransactionPatch = {
  event_id: string;
  transaction: RecentTransaction;
  channel: string;
  date_label: string;
  rule_analysis_completed: boolean;
  suspicious_case: CaseListItem | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableNumber(value: unknown) {
  return value === null || typeof value === "number";
}

function isNullableString(value: unknown) {
  return value === null || typeof value === "string";
}

function isRecentTransaction(value: unknown): value is RecentTransaction {
  return (
    isRecord(value) &&
    Number.isInteger(value.transaction_id) &&
    typeof value.created_at === "string" &&
    typeof value.received_at === "string" &&
    typeof value.prediction_status === "string" &&
    (value.predict_result === null || typeof value.predict_result === "boolean") &&
    isNullableNumber(value.predict_proba) &&
    typeof value.transaction_amount === "number" &&
    typeof value.transaction_datetime === "string" &&
    isNullableNumber(value.risk_score)
  );
}

function isCaseListItem(value: unknown): value is CaseListItem {
  return (
    isRecord(value) &&
    typeof value.case_id === "string" &&
    Number.isInteger(value.transaction_id) &&
    typeof value.execution_status === "string" &&
    isNullableNumber(value.risk_score) &&
    isNullableString(value.risk_grade) &&
    isNullableString(value.primary_fraud_type) &&
    typeof value.transaction_amount === "number" &&
    typeof value.transaction_datetime === "string" &&
    (value.received_at === undefined || typeof value.received_at === "string") &&
    isNullableString(value.ip_address) &&
    typeof value.review_status === "string"
  );
}

export function parseDashboardTransactionPatch(eventData: string) {
  try {
    const payload: unknown = JSON.parse(eventData);
    if (!isRecord(payload) || !isRecord(payload.transaction_patch)) return null;

    const patch = payload.transaction_patch;
    if (
      typeof patch.event_id !== "string" ||
      !isRecentTransaction(patch.transaction) ||
      typeof patch.channel !== "string" ||
      typeof patch.date_label !== "string" ||
      typeof patch.rule_analysis_completed !== "boolean" ||
      !(patch.suspicious_case === null || isCaseListItem(patch.suspicious_case)) ||
      patch.event_id !== `transaction:${patch.transaction.transaction_id}`
    ) {
      return null;
    }

    return patch as DashboardTransactionPatch;
  } catch {
    return null;
  }
}

function upsertLatest<T extends { transaction_id: number }>(
  items: T[],
  item: T,
  limit: number,
  getTime: (value: T) => string,
) {
  return [item, ...items.filter((value) => value.transaction_id !== item.transaction_id)]
    .sort(
      (left, right) =>
        Date.parse(getTime(right)) - Date.parse(getTime(left)) ||
        right.transaction_id - left.transaction_id,
    )
    .slice(0, limit);
}

export function upsertRecentTransaction(
  transactions: RecentTransaction[],
  transaction: RecentTransaction,
) {
  return upsertLatest(
    transactions,
    transaction,
    20,
    (item) => item.received_at || item.created_at,
  );
}

export function upsertRealtimeRiskRow(rows: CaseListItem[], item: CaseListItem) {
  return upsertLatest(
    rows,
    item,
    100,
    (row) => row.received_at || row.transaction_datetime,
  );
}

function isInPeriod(
  transaction: RecentTransaction,
  period: DashboardOverviewPeriod,
) {
  const transactionTime = Date.parse(transaction.transaction_datetime);
  return (
    transactionTime >= Date.parse(period.period_start) &&
    transactionTime < Date.parse(period.period_end)
  );
}

function incrementDistribution(
  items: DistributionItem[],
  label: string,
  amount: number,
) {
  const existing = items.find((item) => item.label === label);
  if (!existing) return [...items, { label, count: 1, amount }];

  return items.map((item) =>
    item.label === label
      ? { ...item, count: item.count + 1, amount: item.amount + amount }
      : item,
  );
}

export function applyDashboardTransactionPatch(
  overview: DashboardOverviewResponse,
  patch: DashboardTransactionPatch,
) {
  if (!isInPeriod(patch.transaction, overview.period)) return overview;

  const suspiciousCase = patch.suspicious_case;
  const amount = suspiciousCase ? Math.abs(suspiciousCase.transaction_amount) : 0;
  const riskGrade = suspiciousCase?.risk_grade ?? null;
  const isPriority = riskGrade === "VERY_HIGH" || riskGrade === "HIGH";

  return {
    ...overview,
    summary: {
      ...overview.summary,
      total_transaction_count: overview.summary.total_transaction_count + 1,
      rule_analysis_completed_count:
        overview.summary.rule_analysis_completed_count +
        (patch.rule_analysis_completed ? 1 : 0),
      suspicious_transaction_count:
        overview.summary.suspicious_transaction_count +
        (suspiciousCase ? 1 : 0),
      suspicious_amount: overview.summary.suspicious_amount + amount,
      priority_review_count:
        overview.summary.priority_review_count + (isPriority ? 1 : 0),
    },
    suspicious_trend: suspiciousCase
      ? overview.suspicious_trend.map((point) =>
          point.date === patch.date_label
            ? {
                ...point,
                suspicious_count: point.suspicious_count + 1,
                suspicious_amount: point.suspicious_amount + amount,
              }
            : point,
        )
      : overview.suspicious_trend,
    priority_trend: isPriority
      ? overview.priority_trend.map((point) =>
          point.date === patch.date_label
            ? {
                ...point,
                very_high_count:
                  point.very_high_count + (riskGrade === "VERY_HIGH" ? 1 : 0),
                high_count: point.high_count + (riskGrade === "HIGH" ? 1 : 0),
                total_count: point.total_count + 1,
              }
            : point,
        )
      : overview.priority_trend,
    risk_grade_distribution: suspiciousCase
      ? incrementDistribution(
          overview.risk_grade_distribution,
          riskGrade || "UNKNOWN",
          amount,
        )
      : overview.risk_grade_distribution,
    channel_distribution: suspiciousCase
      ? incrementDistribution(overview.channel_distribution, patch.channel, amount)
      : overview.channel_distribution,
  };
}
