// 챗봇 화면 한 세션의 상태·대화 이력·턴 실행을 쥔 훅.
// 흐름은 PRD 2.2~2.6 이고, 화면 상태 전이는 docs/customer-chatbot-frontend.md 4장에 정리돼 있다.

import { useCallback, useRef, useState } from "react";

import {
    ChatApiError,
    fetchChatSession,
    sendChatButtonAction,
    sendChatMessage,
    verifyChatSession,
} from "./chatbotApi";
import { useChatScoreEvents } from "./useChatScoreEvents";
import type {
    ChatBubble,
    ChatButtonAction,
    ChatMessage,
    ChatSessionDetail,
    ChatViewStatus,
    FraudTypeCode,
} from "./chatbotTypes";

// 인증 성공 화면을 보여주는 시간. 디자인 원본의 전환 연출 길이다.
const TRANSITION_MS = 1400;

export type ChatPhase = "GATE" | "TRANSITION" | "CHAT" | "NOT_FOUND";

// 서버 이력을 말풍선으로 옮긴다. SYSTEM 안내도 고객 눈에는 챗봇 발화라 같은 쪽에 붙인다.
function toBubbles(messages: ChatMessage[]): ChatBubble[] {
    return messages.map((message) => ({
        key: `server-${message.message_id}`,
        fromBot: message.sender_type !== "HUMAN",
        text: message.message_text,
    }));
}

export function useChatSession(chatSessionId: string) {
    const [phase, setPhase] = useState<ChatPhase>("GATE");
    const [status, setStatus] = useState<ChatViewStatus>("URL_SENT");
    const [isOlder, setIsOlder] = useState(false);
    const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
    // 헤더 알림 버튼과 알림 모달이 쓰는 의심 사기 유형 중, 세션 조회·턴 응답에서 온 값.
    // 백엔드가 fraud_type 을 내려주기 전까지는 계속 null 이고, 그동안은 점수 SSE 가 정한다.
    const [sessionFraudType, setSessionFraudType] =
        useState<FraudTypeCode | null>(null);
    // 점수 SSE 를 열려면 거래 id 가 필요한데, 인증 응답으로 처음 알게 된다.
    const [transactionId, setTransactionId] = useState<number | null>(null);

    // 사기 정황이 추출될 때마다 갱신되는 유형. 상담 도중 알림 버튼을 점등하는 값이다.
    const scoreFraudType = useChatScoreEvents(transactionId);
    // 실시간 점수가 세션 값보다 최신이므로 먼저 본다.
    const fraudType = scoreFraudType ?? sessionFraudType;

    const [verifyBusy, setVerifyBusy] = useState(false);
    const [verifyError, setVerifyError] = useState<string | null>(null);

    // 타이핑 점은 첫 스냅샷까지만, 턴 잠금은 완료 이벤트까지 유지한다.
    const [isTyping, setIsTyping] = useState(false);
    const [turnBusy, setTurnBusy] = useState(false);
    const [turnError, setTurnError] = useState<string | null>(null);

    // 낙관적으로 붙인 말풍선의 key 를 서버 이력과 겹치지 않게 만든다.
    const localBubbleSeq = useRef(0);
    const provisionalBotBubbleKey = useRef<string | null>(null);

    const applyDetail = useCallback((
        detail: ChatSessionDetail,
        preservedHumanBubble?: ChatBubble,
    ) => {
        setStatus(detail.status);
        setIsOlder(detail.is_older);
        setTransactionId(detail.transaction_id);
        setSessionFraudType(detail.fraud_type ?? null);
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

    /** 409 로 상태가 어긋났을 때 서버 값으로 화면을 다시 맞춘다. */
    const resyncSession = useCallback(async (preservedHumanBubble?: ChatBubble) => {
        try {
            applyDetail(
                await fetchChatSession(chatSessionId),
                preservedHumanBubble,
            );
        } catch {
            // 복구 조회까지 실패하면 이미 떠 있는 오류 안내를 그대로 둔다.
        }
    }, [applyDetail, chatSessionId]);

    const handleTurnError = useCallback(
        async (error: unknown, preservedHumanBubble?: ChatBubble) => {
            const message =
                error instanceof ChatApiError
                    ? error.message
                    : "요청을 처리하지 못했습니다.";
            setTurnError(message);

            if (error instanceof ChatApiError && error.status === 409) {
                await resyncSession(preservedHumanBubble);
            }
        },
        [resyncSession],
    );

    /** 출생연도 4자리 인증. 성공하면 전환 화면을 거쳐 챗봇 화면으로 넘어간다. */
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

    /** 최초 알림 뒤 버튼 3종 (PRD 2.3). */
    const selectAction = useCallback(
        async (action: ChatButtonAction) => {
            if (status !== "URL_SENT") {
                return;
            }

            // 버튼을 즉시 감춰 두 번 눌러 409 가 나는 것을 막는다.
            setStatus("SUBMITTING");
            setTurnError(null);
            setTurnBusy(true);
            setIsTyping(true);

            try {
                const result = await sendChatButtonAction(chatSessionId, action);
                setBubbles((current) => [
                    ...current,
                    ...result.messages.map((text, index) => ({
                        key: `local-${(localBubbleSeq.current += 1)}-${index}`,
                        fromBot: true,
                        text,
                    })),
                ]);
                setStatus(result.status);
                // 턴마다 유형이 좁혀질 수 있다. 아직 못 정한 턴은 값을 지우지 않는다.
                if (result.fraud_type) {
                    setSessionFraudType(result.fraud_type);
                }
            } catch (error) {
                await handleTurnError(error);
                setStatus((current) =>
                    current === "SUBMITTING" ? "URL_SENT" : current,
                );
            } finally {
                setIsTyping(false);
                setTurnBusy(false);
            }
        },
        [chatSessionId, handleTurnError, status],
    );

    /**
     * 고객 답변 한 건 전송 (PRD 2.4~2.6).
     * 평가·분해·검색·생성 LLM 을 거쳐 응답이 느리므로 타이핑 표시를 실제 대기 표시로 쓴다.
     */
    const sendAnswer = useCallback(
        async (messageText: string) => {
            const text = messageText.trim();
            if (!text || status !== "IN_PROGRESS" || turnBusy) {
                return;
            }

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
                    onSnapshot: ({ message_index: messageIndex, message_text: botText }) => {
                        if (messageIndex !== 0) {
                            return;
                        }
                        setIsTyping(false);
                        let key = provisionalBotBubbleKey.current;
                        if (!key) {
                            key = `stream-${(localBubbleSeq.current += 1)}`;
                            provisionalBotBubbleKey.current = key;
                        }
                        setBubbles((current) => {
                            const existingIndex = current.findIndex(
                                (bubble) => bubble.key === key,
                            );
                            if (existingIndex < 0) {
                                return [
                                    ...current,
                                    { key, fromBot: true, text: botText },
                                ];
                            }
                            return current.map((bubble, index) =>
                                index === existingIndex
                                    ? { ...bubble, text: botText }
                                    : bubble,
                            );
                        });
                    },
                });

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
                            : current.filter(
                                  (bubble) => bubble.key !== provisionalKey,
                              );
                    }
                    const remaining = provisionalKey
                        ? result.messages.slice(1)
                        : result.messages;
                    return [
                        ...next,
                        ...remaining.map((botText, index) => ({
                            key: `local-${(localBubbleSeq.current += 1)}-${index}`,
                            fromBot: true,
                            text: botText,
                        })),
                    ];
                });
                provisionalBotBubbleKey.current = null;
                setStatus(result.status);
                if (result.fraud_type) {
                    setSessionFraudType(result.fraud_type);
                }
            } catch (error) {
                // 보낸 말풍선은 지우지 않는다. 백엔드가 이미 저장했을 수 있고,
                // 지우면 고객이 같은 말을 두 번 하게 된다.
                const provisionalKey = provisionalBotBubbleKey.current;
                if (provisionalKey) {
                    setBubbles((current) =>
                        current.filter((bubble) => bubble.key !== provisionalKey),
                    );
                    provisionalBotBubbleKey.current = null;
                }
                await handleTurnError(error, humanBubble);
                if (!(error instanceof ChatApiError && error.status === 409)) {
                    await resyncSession(humanBubble);
                }
            } finally {
                setIsTyping(false);
                setTurnBusy(false);
            }
        },
        [chatSessionId, handleTurnError, resyncSession, status, turnBusy],
    );

    return {
        phase,
        status,
        isOlder,
        fraudType,
        bubbles,
        verifyBusy,
        verifyError,
        isTyping,
        turnBusy,
        turnError,
        verify,
        selectAction,
        sendAnswer,
    };
}
