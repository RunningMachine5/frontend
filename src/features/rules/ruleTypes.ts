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

export type RuleTestResult = {
  rule_set_version: number;
  type_scores: {
    type_code: string;
    display_name: string;
    score: number;
    matched_components: string[];
  }[];
};

export type RuleReplay = {
  requested_count: number;
  selected_count: number;
  evaluated_count: number;
  error_count: number;
  changed_transaction_count: number;
  changed_transaction_rate: number | null;
  score_changed_transaction_count: number;
  evidence_changed_transaction_count: number;
  type_summaries: {
    type_code: string;
    display_name: string;
    average_score_delta: number | null;
    score_increased_transaction_count: number;
    score_decreased_transaction_count: number;
    max_absolute_score_delta: number | null;
  }[];
};
