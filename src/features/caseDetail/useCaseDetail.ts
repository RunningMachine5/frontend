import { useEffect, useState } from "react";

import { fetchCaseDetail, saveCaseReview } from "./caseDetailApi";
import type {
  CaseDetailResponse,
  CaseReviewUpsertRequest,
} from "./caseDetailTypes";

type CaseDetailState = {
  detail: CaseDetailResponse | null;
  isLoading: boolean;
  errorMessage: string | null;
};

export function useCaseDetail(transactionId: number | null) {
  const [state, setState] = useState<CaseDetailState>({
    detail: null,
    isLoading: true,
    errorMessage: null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (transactionId === null) {
      setState({ detail: null, isLoading: false, errorMessage: null });
      return () => {
        cancelled = true;
      };
    }

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

  async function saveReview(
    caseId: string,
    request: CaseReviewUpsertRequest,
  ) {
    setIsSaving(true);
    setSaveError(null);

    try {
      const review = await saveCaseReview(caseId, request);
      setState((current) => current.detail ? {
        ...current,
        detail: {
          ...current.detail,
          review: {
            status: "AVAILABLE",
            data: review,
            error_message: null,
          },
        },
      } : current);
      return review;
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "최종 판정 저장에 실패했습니다.",
      );
      throw error;
    } finally {
      setIsSaving(false);
    }
  }

  return { ...state, isSaving, saveError, saveReview };
}
