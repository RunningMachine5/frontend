import { useEffect, useState } from "react";

import { fetchCaseDetail } from "./caseDetailApi";
import type { CaseDetailResponse } from "./caseDetailTypes";

type CaseDetailState = {
  detail: CaseDetailResponse | null;
  isLoading: boolean;
  errorMessage: string | null;
};

export function useCaseDetail(transactionId: number) {
  const [state, setState] = useState<CaseDetailState>({
    detail: null,
    isLoading: true,
    errorMessage: null,
  });

  useEffect(() => {
    let cancelled = false;

    setState({ detail: null, isLoading: true, errorMessage: null });

    fetchCaseDetail(transactionId)
      .then((detail) => {
        if (!cancelled) setState({ detail, isLoading: false, errorMessage: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            detail: null,
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
