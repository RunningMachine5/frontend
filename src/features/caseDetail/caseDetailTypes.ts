import type { ApiResponse } from "../dashboard/dashboardOverviewTypes";

export type SectionStatus = "AVAILABLE" | "PROCESSING" | "EMPTY" | "FAILED" | "NOT_AVAILABLE";

export type SectionResult<T> = {
  status: SectionStatus;
  data: T | null;
  error_message: string | null;
};

export type TransactionView = {
  transaction_id: number;
  transaction_datetime: string;
  transaction_amount: number;
  channel: string;
  location_lat: number | null;
  location_lon: number | null;
  customer_id: number | null;
  source_account_number: string;
  recipient_account_number: string;
  access_medium: string | null;
  operating_system: string | null;
  ip_address: string | null;
  mac_address: string | null;
  num_connection_failure: number;
  rooting_jailbreak_indicator: boolean;
  mobile_roaming_indicator: boolean;
  vpn_indicator: boolean;
  terminal_malicious_behavior_detected: boolean;
};

export type MLView = {
  prediction_status: string;
  is_fraud: boolean | null;
  fraud_probability: number | null;
  model_name: string | null;
  model_version: string | null;
};

export type SimilarCaseView = {
  similar_case_id: string;
  similarity_rank: number;
  similarity_score: number;
  similarity_reason: string;
};

export type CaseAgentView = {
  execution_status: string;
  failure_reason: string | null;
  risk_score: number | null;
  risk_grade: string | null;
  best_similar_case_id: string | null;
  rule_result: {
    rule_filter_status?: string;
    primary_fraud_type?: string | null;
    type_scores?: Record<string, number>;
    matched_components?: Record<string, string[]>;
  } | null;
  investigation_result: Record<string, unknown> | null;
  similar_case_results: SimilarCaseView[];
  response_result: {
    applied_fraud_type?: string;
    summary?: string;
    recommended_actions?: Array<{
      priority: number;
      action_code: string;
      action: string;
      reason: string;
      required: boolean;
    }>;
    checklist?: Array<{
      item_code: string;
      label: string;
      required: boolean;
    }>;
  } | null;
};

export type ChatMessageView = {
  message_id: number;
  sender_type: string;
  message_text: string;
  sent_at: string;
};

export type ChatView = {
  chat_session_id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  messages: ChatMessageView[];
};

export type ReviewDecision = "CONFIRMED_FRAUD" | "FALSE_POSITIVE" | "ON_HOLD";

export type ReviewAction = {
  action_code: string;
  performed: boolean;
};

export type ChecklistResult = {
  item_code: string;
  checked?: boolean;
  cheked?: boolean;
};

export type CaseReviewView = {
  case_id?: string;
  reviewer_id?: string;
  decision: ReviewDecision;
  confirmed_fraud_type: string | null;
  performed_actions: ReviewAction[];
  checklist_results: ChecklistResult[];
  resolution_summary: string | null;
  reviewed_at: string;
};

export type CaseReviewUpsertRequest = {
  decision: ReviewDecision;
  confirmed_fraud_type: string | null;
  performed_actions: ReviewAction[];
  checklist_results: Array<{
    item_code: string;
    checked: boolean;
  }>;
  resolution_summary: string | null;
};

export type CaseDetailResponse = {
  case_id: string;
  transaction_id: number;
  transaction: SectionResult<TransactionView>;
  ml: SectionResult<MLView>;
  case_agent: SectionResult<CaseAgentView>;
  chat: SectionResult<ChatView>;
  review: SectionResult<CaseReviewView>;
};

export type CaseDetailApiResponse = ApiResponse<CaseDetailResponse>;
export type CaseReviewApiResponse = ApiResponse<CaseReviewView>;

// 처리 페이지가 기존 거래·Agent API를 사용하는 동안 유지하는 목록 전용 타입.
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
  similar_case_results: SimilarCaseView[];
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
