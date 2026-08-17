import type {
  AgentCaseApiResponse,
  AgentCaseResult,
  TransactionResult,
} from "./caseDetailTypes";

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) throw new Error("서버가 응답 데이터를 반환하지 않았습니다.");

  return JSON.parse(text) as T;
}

export async function fetchCaseDetail(transactionId: number) {
  const [transactionResponse, agentResponse] = await Promise.all([
    fetch(`/transactions/${transactionId}`),
    fetch(`/api/transactions/${transactionId}/agent-case`),
  ]);

  const transaction = await readJson<TransactionResult>(transactionResponse);

  if (!transactionResponse.ok) {
    throw new Error("거래 정보를 불러오지 못했습니다.");
  }

  const agentResult = await readJson<AgentCaseApiResponse>(agentResponse);

  if (!agentResponse.ok || !agentResult.success || !agentResult.data) {
    throw new Error(agentResult.error?.message ?? "Agent 분석 결과가 없습니다.");
  }

  return { transaction, agent: agentResult.data as AgentCaseResult };
}
