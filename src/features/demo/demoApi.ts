import { adminRequest } from "../admin/adminApi";

export type DemoTransactionInjectionStatus = {
  state: "IDLE" | "RUNNING" | "COMPLETED" | "FAILED";
  total_count: number;
  processed_count: number;
  approved_count: number;
  declined_count: number;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
};

export const fetchDemoTransactionInjectionStatus = () =>
  adminRequest<DemoTransactionInjectionStatus>("/demo-transactions/injection");

export const startDemoTransactionInjection = () =>
  adminRequest<DemoTransactionInjectionStatus>("/demo-transactions/injection", {
    method: "POST",
  });
