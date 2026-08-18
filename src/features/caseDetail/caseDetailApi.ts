import type {
  AgentCaseApiResponse,
  AgentCaseResult,
  CaseDetailApiResponse,
  CaseDetailResponse,
  CaseReviewApiResponse,
  CaseReviewUpsertRequest,
  CaseReviewView,
  TransactionChatSessionDetail,
  TransactionChatSessionDetailApiResponse,
  TransactionChatSessionStatus,
  TransactionChatSessionStatusApiResponse,
} from "./caseDetailTypes";

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) throw new Error("서버가 응답 데이터를 반환하지 않았습니다.");

  return JSON.parse(text) as T;
}

export async function fetchCaseDetail(transactionId: number): Promise<CaseDetailResponse> {
  const response = await fetch(`/api/transactions/${transactionId}/detail`);
  const result = await readJson<CaseDetailApiResponse>(response);

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message ?? "사건 상세 정보를 불러오지 못했습니다.");
  }

  return result.data;
}

export async function fetchAgentCase(transactionId: number): Promise<AgentCaseResult> {
  const response = await fetch(`/api/transactions/${transactionId}/agent-case`);
  const result = await readJson<AgentCaseApiResponse>(response);

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message ?? "Agent 결과를 불러오지 못했습니다.");
  }

  return result.data;
}

export async function fetchChatSessionStatus(
  transactionId: number,
): Promise<TransactionChatSessionStatus> {
  const response = await fetch(`/transactions/${transactionId}/chat-session`);
  const result = await readJson<TransactionChatSessionStatusApiResponse>(response);

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message ?? "채팅 상태를 불러오지 못했습니다.");
  }

  return result.data;
}

export async function fetchChatSessionDetail(
  transactionId: number,
): Promise<TransactionChatSessionDetail> {
  const response = await fetch(`/transactions/${transactionId}/chat-session/detail`);
  const result = await readJson<TransactionChatSessionDetailApiResponse>(response);

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message ?? "채팅 내역을 불러오지 못했습니다.");
  }

  return result.data;
}

export async function saveCaseReview(
  caseId: string,
  request: CaseReviewUpsertRequest,
): Promise<CaseReviewView> {
  const response = await fetch(`/api/cases/${caseId}/review`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const result = await readJson<CaseReviewApiResponse>(response);

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message ?? "최종 판정을 저장하지 못했습니다.");
  }

  return result.data;
}
