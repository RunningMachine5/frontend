export type RuleSetStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";

export type RuleExpression = {
  operator: string;
  field?: string;
  value?: string | number | boolean | (string | number | boolean)[];
  conditions?: RuleExpression[];
};

export type RuleComponent = {
  id: number;
  component_key: string;
  name: string;
  condition_expression: RuleExpression;
  weight: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type RuleComponentInput = Pick<
  RuleComponent,
  "component_key" | "name" | "condition_expression" | "weight" | "sort_order"
>;

export type FraudRule = {
  id: number;
  type_code: string;
  display_name: string;
  description: string | null;
  enabled: boolean;
  sort_order: number;
  components: RuleComponent[];
  created_at: string;
  updated_at: string;
};

export type RuleSetSummary = {
  id: number;
  version: number;
  status: RuleSetStatus;
  created_at: string;
  updated_at: string;
  activated_at: string | null;
};

export type RuleSet = RuleSetSummary & { rules: FraudRule[] };

export type RuleFeature = {
  field: string;
  display_name: string;
  value_type: string;
  operators: string[];
  allowed_values: (string | number | boolean)[] | null;
  derived: boolean;
  source_fields: string[];
};

export type RuleValidation = {
  rule_set_id: number;
  valid: boolean;
  issues: { path: string; message: string }[];
};

export type RuleReplayTypeSummary = {
  type_code: string;
  display_name: string;
  active_enabled: boolean;
  draft_enabled: boolean;
  active_average_score: number | null;
  draft_average_score: number | null;
  average_score_delta: number | null;
  active_matched_transaction_count: number;
  draft_matched_transaction_count: number;
  matched_transaction_count_delta: number;
  score_increased_transaction_count: number;
  score_decreased_transaction_count: number;
  score_unchanged_transaction_count: number;
  max_absolute_score_delta: number | null;
};

export type RuleReplayComponentImpact = {
  type_code: string;
  component_key: string;
  display_name: string;
  active_present: boolean;
  draft_present: boolean;
  active_weight: number | null;
  draft_weight: number | null;
  definition_changed: boolean;
  active_matched_transaction_count: number;
  draft_matched_transaction_count: number;
  matched_transaction_count_delta: number;
  newly_matched_transaction_count: number;
  no_longer_matched_transaction_count: number;
};

export type RuleReplayChangedTransaction = {
  transaction_id: number;
  transaction_datetime: string;
  score_changed: boolean;
  evidence_changed: boolean;
  max_absolute_score_delta: number;
  active_type_scores: Record<string, number>;
  draft_type_scores: Record<string, number>;
  score_deltas: Record<string, number>;
  added_matched_components: Record<string, string[]>;
  removed_matched_components: Record<string, string[]>;
};

export type RuleReplay = {
  selection_basis: "LATEST_ML_POSITIVE";
  aggregation_basis: "EVALUATED_ONLY";
  active_rule_set: { rule_set_id: number; version: number; updated_at: string };
  draft_rule_set: { rule_set_id: number; version: number; updated_at: string };
  requested_count: number;
  selected_count: number;
  evaluated_count: number;
  error_count: number;
  summary_denominator: number;
  detail_limit: number;
  has_more: boolean;
  changed_transaction_count: number;
  changed_transaction_rate: number | null;
  score_changed_transaction_count: number;
  evidence_changed_transaction_count: number;
  active_no_match_count: number;
  draft_no_match_count: number;
  no_match_count_delta: number;
  type_summaries: RuleReplayTypeSummary[];
  component_impacts: RuleReplayComponentImpact[];
  changed_transaction_details: RuleReplayChangedTransaction[];
  error_details: {
    transaction_id: number;
    transaction_datetime: string;
    error: string;
  }[];
  changed_details_truncated: boolean;
  error_details_truncated: boolean;
};
