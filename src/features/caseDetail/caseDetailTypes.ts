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
  location: string;
  customer_id: string;
  source_account_id: string;
  recipient_account_id: string | null;
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
  message_id: string;
  sender_type: string;
  message_text: string;
  sent_at: string;
};

export type ChatView = {
  chat_session_id: string | null;
  session_status: string | null;
  started_at: string | null;
  closed_at: string | null;
  messages: ChatMessageView[];
};

export type CaseDetailResponse = {
  case_id: string;
  transaction_id: number;
  transaction: SectionResult<TransactionView>;
  ml: SectionResult<MLView>;
  case_agent: SectionResult<CaseAgentView>;
  chat: SectionResult<ChatView>;
  review: SectionResult<Record<string, unknown>>;
};

export type CaseDetailApiResponse = ApiResponse<CaseDetailResponse>;
