export type CaseListItem = {
  case_id: string;
  transaction_id: number;
  execution_status: string;
  risk_score: number | null;
  risk_grade: string | null;
  primary_fraud_type: string | null;
  transaction_amount: number;
  transaction_datetime: string;
  received_at: string;
  ip_address: string | null;
  review_status: string;
};

export type CaseListResponse = {
  items: CaseListItem[];
  page: number;
  page_size: number;
  total_count: number;
};

export type QueueSearchFilters = {
  transactionId: string;
  ipAddress: string;
  periodStart: string;
  periodEnd: string;
  page: number;
};
