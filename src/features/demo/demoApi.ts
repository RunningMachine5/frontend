import { adminRequest } from "../admin/adminApi";

export type DemoTransactionCount = 100 | 500 | 1000;

export type DemoTransactionInjectionRequest = {
  transaction_count: DemoTransactionCount;
  transactions_per_second: number;
};

export type DemoTransactionInjectionStatus = {
  state: "IDLE" | "RUNNING" | "COMPLETED" | "FAILED";
  total_count: DemoTransactionCount;
  transactions_per_second: number;
  processed_count: number;
  approved_count: number;
  declined_count: number;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
};

export const fetchDemoTransactionInjectionStatus = () =>
  adminRequest<DemoTransactionInjectionStatus>("/demo-transactions/injection");

export const startDemoTransactionInjection = (
  request: DemoTransactionInjectionRequest,
) =>
  adminRequest<DemoTransactionInjectionStatus>("/demo-transactions/injection", {
    method: "POST",
    body: JSON.stringify(request),
  });
