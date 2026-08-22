import type { ApiResponse } from "../dashboard/dashboardOverviewTypes";
import type { CaseListResponse, QueueSearchFilters } from "./queueTypes";

function appendDateTime(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, new Date(value).toISOString());
}

export async function fetchQueueRows(
  filters: QueueSearchFilters,
  pageSize: number,
  sortBy: "transaction_datetime" | "received_at" = "transaction_datetime",
) {
  const params = new URLSearchParams({
    page: String(filters.page),
    page_size: String(pageSize),
    sort_by: sortBy,
  });

  if (filters.transactionId.trim()) {
    params.set("transaction_id", filters.transactionId.trim());
  }
  if (filters.ipAddress.trim()) {
    params.set("ip_address", filters.ipAddress.trim());
  }
  filters.riskGrades.forEach((riskGrade) => {
    params.append("risk_grades", riskGrade);
  });
  filters.reviewStatuses.forEach((reviewStatus) => {
    params.append("review_statuses", reviewStatus);
  });
  appendDateTime(params, "period_start", filters.periodStart);
  appendDateTime(params, "period_end", filters.periodEnd);

  const response = await fetch(`/api/cases?${params.toString()}`);
  const body = (await response.json()) as ApiResponse<CaseListResponse>;

  if (!response.ok || !body.success || !body.data) {
    throw new Error(body.error?.message ?? "처리 목록을 불러오지 못했습니다.");
  }

  return body.data;
}
