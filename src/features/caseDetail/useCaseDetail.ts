import { useEffect, useState } from "react";

import {
  fetchAgentCase,
  fetchCaseDetail,
  fetchChatSessionDetail,
  fetchChatSessionStatus,
  saveCaseReview,
} from "./caseDetailApi";
import type {
  AgentCaseResult,
  CaseAgentView,
  CaseDetailResponse,
  CaseReviewUpsertRequest,
  ChatView,
  TransactionChatSessionDetail,
} from "./caseDetailTypes";

const POLLING_INTERVAL_MS = 2_000;

function toCaseAgentView(agent: AgentCaseResult): CaseAgentView {
  return {
    execution_status: agent.execution_status,
    failure_reason: agent.failure_reason,
    risk_score: agent.risk_score,
    risk_grade: agent.risk_grade,
    best_similar_case_id: agent.best_similar_case_id,
    rule_result: agent.rule_result,
    investigation_result: agent.investigation_result,
    similar_case_results: agent.similar_case_results,
    response_result: agent.response_result,
  };
}

function toChatView(
  chat: TransactionChatSessionDetail,
  previous: ChatView | null,
): ChatView | null {
  if (!chat.chat_session_id || !chat.status) return null;

  return {
    chat_session_id: chat.chat_session_id,
    status: chat.status,
    created_at: previous?.created_at ?? chat.messages[0]?.sent_at ?? null,
    completed_at: chat.completed_at,
    messages: chat.messages,
    type_scores: chat.type_scores,
  };
}

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
    let pollingTimer: number | null = null;
    let agentFinished = false;
    let lastChatStatus = "";

    if (transactionId === null) {
      setState({ detail: null, isLoading: false, errorMessage: null });
      return () => {
        cancelled = true;
      };
    }

    setState({ detail: null, isLoading: true, errorMessage: null });

    async function pollLiveSections() {
      if (!agentFinished) {
        try {
          const agent = await fetchAgentCase(transactionId as number);
          if (!cancelled) {
            setState((current) => current.detail ? {
              ...current,
              detail: {
                ...current.detail,
                case_agent: {
                  status: agent.execution_status === "FAILED" ? "FAILED" : "AVAILABLE",
                  data: toCaseAgentView(agent),
                  error_message: agent.failure_reason,
                },
              },
            } : current);
          }
          agentFinished = ["COMPLETED", "FAILED"].includes(agent.execution_status);
        } catch {
          // Agent 사건이 아직 생성되지 않았으면 다음 Polling에서 다시 확인한다.
        }
      }

      try {
        const chatStatus = await fetchChatSessionStatus(transactionId as number);
        if (cancelled) return;

        const statusKey = `${chatStatus.chat_session_id ?? ""}:${chatStatus.status ?? ""}`;
        const isActiveChat = ["URL_SENT", "IN_PROGRESS", "HANDOFF_REQUESTED"].includes(
          chatStatus.status ?? "",
        );

        if (!chatStatus.chat_session_id) {
          setState((current) => current.detail ? {
            ...current,
            detail: {
              ...current.detail,
              chat: { status: "EMPTY", data: null, error_message: null },
            },
          } : current);
        } else if (statusKey !== lastChatStatus || isActiveChat) {
          const chatDetail = await fetchChatSessionDetail(transactionId as number);
          if (!cancelled) {
            setState((current) => {
              if (!current.detail) return current;
              const chat = toChatView(chatDetail, current.detail.chat.data);

              return {
                ...current,
                detail: {
                  ...current.detail,
                  chat: {
                    status: chat ? "AVAILABLE" : "EMPTY",
                    data: chat,
                    error_message: null,
                  },
                },
              };
            });
          }
        }

        lastChatStatus = statusKey;
      } catch {
        // 채팅 세션이 아직 준비되지 않았으면 기존 화면을 유지한다.
      }
    }

    fetchCaseDetail(transactionId)
      .then(async (detail) => {
        if (cancelled) return;
        setState({ detail, isLoading: false, errorMessage: null });
        await pollLiveSections();
        if (!cancelled) {
          pollingTimer = window.setInterval(
            () => void pollLiveSections(),
            POLLING_INTERVAL_MS,
          );
        }
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
      if (pollingTimer !== null) window.clearInterval(pollingTimer);
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
