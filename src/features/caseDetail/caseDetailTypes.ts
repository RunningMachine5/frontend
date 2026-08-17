import type { ApiResponse } from "../dashboard/dashboardOverviewTypes";

export type TransactionResult = {
  transaction_id: number;
  prediction_status: "COMPLETED" | "FAILED" | string;
  predict_result: boolean | null;
  predict_proba: number | null;
  rule_set_id: number | null;
  rule_scores: Record<string, number> | null;
  confirmed_is_fraud: boolean | null;
  labeled_at: string | null;
  created_at: string;
};

export type RuleEvidence = {
  fraud_type: string;
  evidence_code: string;
  observed_value: unknown;
  contribution: number;
};

export type AgentCaseResult = {
  case_id: string;
  transaction_id: number;
  execution_status: string;
  failure_reason: string | null;
  risk_score: number;
  risk_grade: string;
  rule_result: {
    primary_fraud_type: string | null;
    type_scores: Record<string, number>;
    matched_components: RuleEvidence[];
  };
  investigation_result: {
    classification_status: string;
    investigation_status: string;
    recommendation_reason: string | null;
    best_similarity_score: number | null;
    common_evidence_codes: string[];
    confirmed_case_count: number;
  } | null;
  similar_case_results: Array<{
    similar_case_id: string;
    similarity_rank: number;
    similarity_score: number;
    similarity_reason: string;
  }>;
  response_result: {
    applied_fraud_type: string;
    information_status: string;
    summary: string;
    recommended_actions: Array<{
      priority: number;
      action_code: string;
      action: string;
      reason: string;
      required: boolean;
    }>;
    checklist: Array<{
      item_code: string;
      label: string;
      required: boolean;
    }>;
  } | null;
};

export type AgentCaseApiResponse = ApiResponse<AgentCaseResult>;
