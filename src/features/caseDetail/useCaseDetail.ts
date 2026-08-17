import { useEffect, useState } from "react";

import { fetchCaseDetail } from "./caseDetailApi";
import type { AgentCaseResult, TransactionResult } from "./caseDetailTypes";

type CaseDetailState = {
  transaction: TransactionResult | null;
  agent: AgentCaseResult | null;
  isLoading: boolean;
  errorMessage: string | null;
};

export function useCaseDetail(transactionId: number) {
  const [state, setState] = useState<CaseDetailState>({
    transaction: null,
    agent: null,
    isLoading: true,
    errorMessage: null,
  });

  useEffect(() => {
    let cancelled = false;

    setState({ transaction: null, agent: null, isLoading: true, errorMessage: null });

    fetchCaseDetail(transactionId)
      .then((result) => {
        if (!cancelled) {
          setState({ ...result, isLoading: false, errorMessage: null });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            transaction: null,
            agent: null,
            isLoading: false,
            errorMessage: error instanceof Error ? error.message : "상세 조회에 실패했습니다.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [transactionId]);

  return state;
}
