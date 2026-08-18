import type { ApiResponse } from "../dashboard/dashboardOverviewTypes";

const ADMIN_TOKEN_KEY = "fdshield_mlops_admin_token";

export function readAdminToken() {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
}

export function storeAdminToken(token: string) {
  const normalized = token.trim();
  if (normalized) sessionStorage.setItem(ADMIN_TOKEN_KEY, normalized);
  else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  return normalized;
}

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
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-MLOps-Admin-Token": token,
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
