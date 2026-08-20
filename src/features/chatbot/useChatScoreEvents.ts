// 거래의 사기 정황 점수 SSE 를 구독해, 지금 앞서는 사기 유형 하나로 줄여 돌려주는 훅.
// 스트림은 담당자 화면용으로 만들어졌지만 점수 전용이라 고객 화면도 그대로 쓴다
// (backend/docs/customer-chatbot/README.md 2.7 「사기 정황 점수 실시간 스트림」).
// 사기 정황이 추출될 때마다 이벤트가 오므로 헤더 알림 버튼이 상담 도중에 점등된다.

import { useEffect, useState } from "react";

import type {
    ChatFraudTypeScore,
    ChatScoreUpdatedEvent,
    FraudTypeCode,
} from "./chatbotTypes";

const SCORE_EVENT_NAME = "chat_score_updated";

/**
 * 점수 목록에서 점등할 유형 하나를 고른다.
 * 0점뿐이거나 최고점이 동점이면 고객에게 보일 근거가 부족하므로 null 이다.
 * 백엔드가 점수 내림차순으로 보내주지만 순서에 기대지 않고 직접 최고점을 찾는다.
 */
export function pickLeadingFraudType(
    typeScores: ChatFraudTypeScore[],
): FraudTypeCode | null {
    let leading: ChatFraudTypeScore | null = null;
    let tied = false;

    for (const entry of typeScores) {
        if (leading === null || entry.score > leading.score) {
            leading = entry;
            tied = false;
        } else if (entry.score === leading.score) {
            tied = true;
        }
    }

    if (leading === null || leading.score <= 0 || tied) {
        return null;
    }

    return leading.type_code;
}

/** transaction_id 를 알기 전(인증 전)에는 null 을 넘긴다. 그때는 구독하지 않는다. */
export function useChatScoreEvents(
    transactionId: number | null,
): FraudTypeCode | null {
    const [leadingFraudType, setLeadingFraudType] =
        useState<FraudTypeCode | null>(null);

    useEffect(() => {
        // 다른 거래로 바뀌면 이전 거래의 유형을 들고 있지 않는다.
        setLeadingFraudType(null);

        if (transactionId === null) {
            return;
        }

        // StrictMode 이중 실행으로 닫힌 연결의 이벤트가 늦게 들어오는 것을 막는다.
        let isActive = true;

        const eventSource = new EventSource(
            `/transactions/${transactionId}/chat-session/score-events`,
        );

        eventSource.addEventListener(SCORE_EVENT_NAME, (event) => {
            if (!isActive) {
                return;
            }

            let payload: ChatScoreUpdatedEvent;

            try {
                payload = JSON.parse((event as MessageEvent<string>).data);
            } catch {
                // 형식이 깨진 이벤트 하나 때문에 구독을 끊지는 않는다.
                return;
            }

            const leading = pickLeadingFraudType(payload.type_scores ?? []);

            // 아직 앞서는 유형이 없는 갱신은 이미 점등한 유형을 끄지 않는다
            // (턴 응답의 fraud_type 을 다루는 규칙과 같다).
            if (leading !== null) {
                setLeadingFraudType(leading);
            }
        });

        // 연결이 끊기면 브라우저가 서버가 지정한 retry(3초) 뒤 스스로 다시 연결한다.

        return () => {
            isActive = false;
            eventSource.close();
        };
    }, [transactionId]);

    return leadingFraudType;
}
