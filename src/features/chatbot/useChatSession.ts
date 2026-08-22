// 챗봇 화면 한 세션의 생명주기·대화 단계·입력 계약과 턴 실행을 관리한다.

import { useCallback, useRef, useState } from "react";

import {
    ChatApiError,
    fetchChatSession,
    sendChatMessage,
    sendDiscriminationAction,
    verifyChatSession,
} from "./chatbotApi";
import type { ChatMessageSnapshot } from "./chatbotApi";
import type {
    ChatBubble,
    ChatConversationPhase,
    ChatInputMode,
    ChatMessage,
    ChatQuickReply,
    ChatSessionDetail,
    ChatSessionStatus,
    ChatTurnResult,
    DiscriminationQuestionId,
    FraudTypeConfirmedEvent,
} from "./chatbotTypes";

const TRANSITION_MS = 1400;

export type ChatPhase = "GATE" | "TRANSITION" | "CHAT" | "NOT_FOUND";

function toBubbles(messages: ChatMessage[]): ChatBubble[] {
    return messages.map((message) => ({
        key: `server-${message.message_id}`,
        fromBot: message.sender_type !== "HUMAN",
        text: message.message_text,
    }));
}

export function useChatSession(chatSessionId: string) {
    const [phase, setPhase] = useState<ChatPhase>("GATE");
    const [status, setStatus] = useState<ChatSessionStatus>("URL_SENT");
    const [conversationPhase, setConversationPhase] =
        useState<ChatConversationPhase | null>(null);
    const [inputMode, setInputMode] = useState<ChatInputMode>("NONE");
    const [questionId, setQuestionId] =
        useState<DiscriminationQuestionId | null>(null);
    const [quickReplies, setQuickReplies] = useState<ChatQuickReply[]>([]);
    const [isOlder, setIsOlder] = useState(false);
    const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
    const [uiEvent, setUiEvent] =
        useState<FraudTypeConfirmedEvent | null>(null);

    const [verifyBusy, setVerifyBusy] = useState(false);
    const [verifyError, setVerifyError] = useState<string | null>(null);
    const [isTyping, setIsTyping] = useState(false);
    const [turnBusy, setTurnBusy] = useState(false);
    const [turnError, setTurnError] = useState<string | null>(null);

    const localBubbleSeq = useRef(0);
    const provisionalBotBubbleKey = useRef<string | null>(null);
    // React 렌더 전에 연속으로 들어오는 더블클릭도 막는다.
    const turnBusyRef = useRef(false);
    // 같은 질문·액션을 재시도할 때 같은 멱등 키를 재사용한다.
    const requestIds = useRef(new Map<string, string>());

    const applyTurnContract = useCallback((result: ChatTurnResult) => {
        setStatus(result.status);
        setConversationPhase(result.conversation_phase);
        setInputMode(result.input_mode);
        setQuestionId(result.question_id);
        setQuickReplies(result.quick_replies);
    }, []);

    const applyDetail = useCallback((
        detail: ChatSessionDetail,
        preservedHumanBubble?: ChatBubble,
    ) => {
        setStatus(detail.status);
        setConversationPhase(detail.conversation_phase);
        setInputMode(detail.input_mode);
        setQuestionId(detail.question_id);
        setQuickReplies(detail.quick_replies);
        setIsOlder(detail.is_older);

        const serverBubbles = toBubbles(detail.messages);
        const latestHumanMessage = [...detail.messages]
            .reverse()
            .find((message) => message.sender_type === "HUMAN");
        if (
            preservedHumanBubble &&
            latestHumanMessage?.message_text !== preservedHumanBubble.text
        ) {
            serverBubbles.push(preservedHumanBubble);
        }
        setBubbles(serverBubbles);
    }, []);

    const resyncSession = useCallback(async (preservedHumanBubble?: ChatBubble) => {
        try {
            applyDetail(
                await fetchChatSession(chatSessionId),
                preservedHumanBubble,
            );
        } catch {
            // 복구 조회까지 실패하면 기존 오류 안내와 화면 상태를 유지한다.
        }
    }, [applyDetail, chatSessionId]);

    const handleTurnError = useCallback(
        async (error: unknown, preservedHumanBubble?: ChatBubble) => {
            setTurnError(
                error instanceof ChatApiError
                    ? error.message
                    : "요청을 처리하지 못했습니다.",
            );
            await resyncSession(preservedHumanBubble);
        },
        [resyncSession],
    );

    const handleSnapshot = useCallback((snapshot: ChatMessageSnapshot) => {
        if (snapshot.message_index !== 0) {
            return;
        }
        setIsTyping(false);
        let key = provisionalBotBubbleKey.current;
        if (!key) {
            key = `stream-${(localBubbleSeq.current += 1)}`;
            provisionalBotBubbleKey.current = key;
        }
        const bubbleKey = key;
        setBubbles((current) => {
            const existingIndex = current.findIndex(
                (bubble) => bubble.key === bubbleKey,
            );
            if (existingIndex < 0) {
                return [
                    ...current,
                    { key: bubbleKey, fromBot: true, text: snapshot.message_text },
                ];
            }
            return current.map((bubble, index) =>
                index === existingIndex
                    ? { ...bubble, text: snapshot.message_text }
                    : bubble,
            );
        });
    }, []);

    const completeTurn = useCallback((result: ChatTurnResult) => {
        const provisionalKey = provisionalBotBubbleKey.current;
        setBubbles((current) => {
            let next = current;
            if (provisionalKey) {
                next = result.messages.length
                    ? current.map((bubble) =>
                          bubble.key === provisionalKey
                              ? { ...bubble, text: result.messages[0] }
                              : bubble,
                      )
                    : current.filter((bubble) => bubble.key !== provisionalKey);
            }
            const remaining = provisionalKey
                ? result.messages.slice(1)
                : result.messages;
            return [
                ...next,
                ...remaining.map((text, index) => ({
                    key: `local-${(localBubbleSeq.current += 1)}-${index}`,
                    fromBot: true,
                    text,
                })),
            ];
        });
        provisionalBotBubbleKey.current = null;
        applyTurnContract(result);
    }, [applyTurnContract]);

    const removeProvisionalBubble = useCallback(() => {
        const provisionalKey = provisionalBotBubbleKey.current;
        if (!provisionalKey) {
            return;
        }
        setBubbles((current) =>
            current.filter((bubble) => bubble.key !== provisionalKey),
        );
        provisionalBotBubbleKey.current = null;
    }, []);

    const verify = useCallback(
        async (birthYear: string) => {
            if (verifyBusy) {
                return;
            }
            setVerifyBusy(true);
            setVerifyError(null);

            try {
                applyDetail(await verifyChatSession(chatSessionId, birthYear));
                setPhase("TRANSITION");
                window.setTimeout(() => setPhase("CHAT"), TRANSITION_MS);
            } catch (error) {
                if (error instanceof ChatApiError && error.status === 404) {
                    setPhase("NOT_FOUND");
                } else {
                    setVerifyError(
                        error instanceof ChatApiError
                            ? error.message
                            : "본인인증에 실패했습니다.",
                    );
                }
            } finally {
                setVerifyBusy(false);
            }
        },
        [applyDetail, chatSessionId, verifyBusy],
    );

    const selectQuickReply = useCallback(
        async (reply: ChatQuickReply) => {
            if (
                inputMode !== "QUICK_REPLY" ||
                !questionId ||
                turnBusyRef.current ||
                !quickReplies.some((item) => item.action === reply.action)
            ) {
                return;
            }

            turnBusyRef.current = true;
            setTurnBusy(true);
            setTurnError(null);
            setIsTyping(true);
            provisionalBotBubbleKey.current = null;

            const submittedQuestionId = questionId;
            const requestKey = `${submittedQuestionId}:${reply.action}`;
            const requestId = requestIds.current.get(requestKey)
                ?? crypto.randomUUID();
            requestIds.current.set(requestKey, requestId);

            const humanBubble: ChatBubble = {
                key: `local-${(localBubbleSeq.current += 1)}`,
                fromBot: false,
                text: reply.label,
            };
            setBubbles((current) => [...current, humanBubble]);

            try {
                const result = await sendDiscriminationAction(
                    chatSessionId,
                    reply.action,
                    submittedQuestionId,
                    requestId,
                    {
                        onSnapshot: handleSnapshot,
                        onFraudTypeConfirmed: setUiEvent,
                    },
                );
                completeTurn(result);
                requestIds.current.delete(requestKey);
            } catch (error) {
                removeProvisionalBubble();
                await handleTurnError(error, humanBubble);
            } finally {
                setIsTyping(false);
                setTurnBusy(false);
                turnBusyRef.current = false;
            }
        },
        [
            chatSessionId,
            completeTurn,
            handleSnapshot,
            handleTurnError,
            inputMode,
            questionId,
            quickReplies,
            removeProvisionalBubble,
        ],
    );

    const sendAnswer = useCallback(
        async (messageText: string) => {
            const text = messageText.trim();
            if (!text || inputMode !== "FREE_TEXT" || turnBusyRef.current) {
                return;
            }

            turnBusyRef.current = true;
            setTurnError(null);
            const humanBubble: ChatBubble = {
                key: `local-${(localBubbleSeq.current += 1)}`,
                fromBot: false,
                text,
            };
            setBubbles((current) => [...current, humanBubble]);
            provisionalBotBubbleKey.current = null;
            setTurnBusy(true);
            setIsTyping(true);

            try {
                const result = await sendChatMessage(chatSessionId, text, {
                    onSnapshot: handleSnapshot,
                });
                completeTurn(result);
            } catch (error) {
                removeProvisionalBubble();
                await handleTurnError(error, humanBubble);
            } finally {
                setIsTyping(false);
                setTurnBusy(false);
                turnBusyRef.current = false;
            }
        },
        [
            chatSessionId,
            completeTurn,
            handleSnapshot,
            handleTurnError,
            inputMode,
            removeProvisionalBubble,
        ],
    );

    return {
        phase,
        status,
        conversationPhase,
        inputMode,
        questionId,
        quickReplies,
        isOlder,
        bubbles,
        uiEvent,
        verifyBusy,
        verifyError,
        isTyping,
        turnBusy,
        turnError,
        verify,
        selectQuickReply,
        sendAnswer,
        dismissUiEvent: () => setUiEvent(null),
    };
}
