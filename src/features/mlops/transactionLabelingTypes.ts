export type TransactionLabelStatus = "ALL" | "UNLABELED" | "NORMAL" | "FRAUD";
export type TransactionPredictionFilter = "ALL" | "NORMAL" | "FRAUD";

export type TransactionLabelQueueSummary = {
  total_count: number;
  unlabeled_count: number;
  normal_count: number;
  fraud_count: number;
};

export type TransactionLabelQueueItem = {
  transaction_id: number;
  customer_id: number | null;
  transaction_datetime: string;
  transaction_amount: number;
  channel: string;
  transaction_status: "APPROVED" | "DECLINED" | null;
  source_account_number: string;
  recipient_account_number: string;
  initial_balance: number | null;
  balance: number | null;
  access_medium: string | null;
  operating_system: string | null;
  ip_address: string | null;
  mac_address: string | null;
  location_lat: number | null;
  location_lon: number | null;
  num_connection_failure: number;
  rooting_jailbreak_indicator: boolean;
  mobile_roaming_indicator: boolean;
  vpn_indicator: boolean;
  terminal_malicious_behavior_detected: boolean;
  predict_result: boolean | null;
  predict_proba: number | null;
  model_name: string | null;
  model_version: string | null;
  predicted_at: string | null;
  confirmed_is_fraud: boolean | null;
  labeled_at: string | null;
};

export type TransactionLabelQueueResponse = {
  items: TransactionLabelQueueItem[];
  summary: TransactionLabelQueueSummary;
  page: number;
  page_size: number;
  total_count: number;
};
