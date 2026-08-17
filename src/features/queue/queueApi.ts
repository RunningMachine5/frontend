import type { AgentCaseResult, TransactionResult } from "../caseDetail/caseDetailTypes";
import type { ApiResponse } from "../dashboard/dashboardOverviewTypes";

export type QueueRow = TransactionResult & { agent: AgentCaseResult | null };

async function getAgentCase(transactionId: number) {
  const response = await fetch(`/api/transactions/${transactionId}/agent-case`);
  if (!response.ok) return null;
  const body = (await response.json()) as ApiResponse<AgentCaseResult>;
  return body.success ? body.data : null;
}

// 목록 API는 검색/페이지네이션을 지원하지 않아, 화면에서는 최신 의심 거래 24건만 사용한다.
export async function fetchQueueRows() {
  const response = await fetch("/transactions");
  if (!response.ok) throw new Error("거래 목록을 불러오지 못했습니다.");

  const allTransactions = (await response.json()) as TransactionResult[];
  const suspicious = allTransactions
    .filter((transaction) => transaction.predict_result === true)
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 24);

  const rows = await Promise.all(
    suspicious.map(async (transaction) => ({
      ...transaction,
      agent: await getAgentCase(transaction.transaction_id),
    })),
  );

  return { allCount: allTransactions.length, suspiciousCount: suspicious.length, rows };
}
