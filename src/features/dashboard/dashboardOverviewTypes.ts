// 백엔드(/api/dashboard/overview)의 응답 구조를 타입 스크립트 타입으로 정의함

export type ApiError = {
    code: string;
    message: string;
    details: unknown | null;
};

export type ApiResponse<T> = {
    success: boolean;
    data: T | null;
    error: ApiError | null;
};

export type DashboardOverviewPeriod = {
    period_start: string;
    period_end: string;
};

export type DashboardOverviewSummary = {
    total_transaction_count: number;
    suspicious_transaction_count: number;
    priority_review_count: number;
    suspicious_amount: number;
    rule_analysis_completed_count: number;
};

export type PriorityTrendPoint = {
    date: string;
    very_high_count: number;
    high_count: number;
    total_count: number;
};

export type SuspiciousTrendPoint = {
    date: string;
    suspicious_count: number;
    suspicious_amount: number;
};

export type DistributionItem = {
    label: string;
    count: number;
    amount: number;
};

export type DashboardAgentInsight = {
    insight_id: string;
    title: string;
    summary: string;
    chart_spec: Record<string, unknown>;
    created_at: string;
};

export type DashboardOverviewResponse = {
  period: DashboardOverviewPeriod;
  summary: DashboardOverviewSummary;
  priority_trend: PriorityTrendPoint[];
  suspicious_trend: SuspiciousTrendPoint[];
  risk_grade_distribution: DistributionItem[];
  channel_distribution: DistributionItem[];
  agent_insight: DashboardAgentInsight | null;
}