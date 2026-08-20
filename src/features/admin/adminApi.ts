import type { ApiResponse } from "../dashboard/dashboardOverviewTypes";

function errorMessage(body: unknown, fallback: string) {
  if (!body || typeof body !== "object") return fallback;
  const source = body as Record<string, unknown>;
  const common = source.error as ApiResponse<unknown>["error"];
  if (common?.message) return common.message;
  if (typeof source.detail === "string") return source.detail;
  if (source.detail && typeof source.detail === "object") {
    const detail = source.detail as Record<string, unknown>;
    if (typeof detail.message === "string") return detail.message;
  }
  return fallback;
}

export async function adminRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const response = await fetch(`/api${path}`, {
    ...init,
    cache: init.cache ?? (method === "GET" ? "no-store" : "default"),
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const body = response.status === 204 ? null : await response.json();

  if (!response.ok) {
    throw new Error(errorMessage(body, "관리 API 요청에 실패했습니다."));
  }
  if (body && typeof body === "object" && "success" in body) {
    return (body as ApiResponse<T>).data as T;
  }
  return body as T;
}
