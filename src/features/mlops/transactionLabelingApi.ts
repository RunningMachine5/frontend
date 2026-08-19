import type {
  TransactionLabelQueueResponse,
  TransactionLabelStatus,
  TransactionPredictionFilter,
} from "./transactionLabelingTypes";

type QueueQuery = {
  labelStatus: TransactionLabelStatus;
  prediction: TransactionPredictionFilter;
  transactionId: number | null;
  page: number;
  pageSize: number;
};

async function errorMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { detail?: string } | null;
  return body?.detail ?? fallback;
}

export async function fetchTransactionLabelQueue(query: QueueQuery) {
  const params = new URLSearchParams({
    label_status: query.labelStatus,
    prediction: query.prediction,
    page: String(query.page),
    page_size: String(query.pageSize),
  });
  if (query.transactionId !== null) {
    params.set("transaction_id", String(query.transactionId));
  }

  const response = await fetch(`/transactions/label-queue?${params}`);
  if (!response.ok) {
    throw new Error(await errorMessage(
      response,
      "라벨링 거래를 불러오지 못했습니다. 목록 새로고침을 눌러 다시 시도하세요.",
    ));
  }
  return response.json() as Promise<TransactionLabelQueueResponse>;
}

export async function saveTransactionLabel(
  transactionId: number,
  confirmedIsFraud: boolean,
) {
  const response = await fetch(`/transactions/${transactionId}/label`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmed_is_fraud: confirmedIsFraud }),
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, "거래 판정을 저장하지 못했습니다. 다시 시도하세요."));
  }
}

export async function clearTransactionLabel(transactionId: number) {
  const response = await fetch(`/transactions/${transactionId}/label`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, "거래 판정을 지우지 못했습니다. 다시 시도하세요."));
  }
}
