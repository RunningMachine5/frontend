// 챗봇 고객 경로 4종 호출과 공통 응답 봉투 해제.
// 백엔드 라우터 prefix 는 /chat 이지만 브라우저 화면 주소와 겹치므로 /api/chat 으로 부른다
// (vite.config.ts 의 프록시가 /api 를 떼어낸다).

import type {
    ApiResponse,
    ChatButtonAction,
    ChatSessionDetail,
    ChatTurnResult,
} from "./chatbotTypes";

const CHAT_API_BASE = "/api/chat";

// 화면이 상태코드별로 다르게 처리해야 해서(401 재시도, 404 오류화면, 409 재조회)
// status 를 그대로 들고 다니는 오류 타입을 쓴다.
export class ChatApiError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = "ChatApiError";
        this.status = status;
    }
}

async function requestChatApi<T>(
    path: string,
    init?: RequestInit,
): Promise<T> {
    let response: Response;

    try {
        response = await fetch(`${CHAT_API_BASE}${path}`, init);
    } catch {
        // fetch 자체가 실패하면 상태코드가 없다. 네트워크 오류로 구분한다.
        throw new ChatApiError(0, "서버에 연결하지 못했습니다.");
    }

    let result: ApiResponse<T> | null = null;

    try {
        result = (await response.json()) as ApiResponse<T>;
    } catch {
        result = null;
    }

    // HTTP 200 이어도 success 가 false 일 수 있으므로 둘 다 확인한다.
    if (!response.ok || !result?.success || !result.data) {
        throw new ChatApiError(
            response.status,
            result?.error?.message ?? "요청을 처리하지 못했습니다.",
        );
    }

    return result.data;
}

function jsonRequest(body: unknown): RequestInit {
    return {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    };
}

/**
 * 출생연도 4자리 본인인증 (PRD 2.2).
 * 고객이 처음 접속할 때 부르는 경로이며, 첫 진입이면 최초 알림까지 만들어 돌려준다.
 */
export function verifyChatSession(
    chatSessionId: string,
    birthYear: string,
): Promise<ChatSessionDetail> {
    return requestChatApi<ChatSessionDetail>(
        `/${encodeURIComponent(chatSessionId)}/verify`,
        jsonRequest({ birth_year: birthYear }),
    );
}

/**
 * 세션 상태와 대화 이력 조회. 인증을 마친 화면의 새로고침·복구 전용이다.
 * 최초 알림을 만들지 않으므로 첫 접속에 쓰지 않는다.
 */
export function fetchChatSession(
    chatSessionId: string,
): Promise<ChatSessionDetail> {
    return requestChatApi<ChatSessionDetail>(
        `/${encodeURIComponent(chatSessionId)}`,
    );
}

/** 최초 알림 뒤 버튼 3종 처리 (PRD 2.3). status 가 URL_SENT 일 때만 받는다. */
export function sendChatButtonAction(
    chatSessionId: string,
    action: ChatButtonAction,
): Promise<ChatTurnResult> {
    return requestChatApi<ChatTurnResult>(
        `/${encodeURIComponent(chatSessionId)}/actions`,
        jsonRequest({ action }),
    );
}

/** 고객 답변 한 건 전송 (PRD 2.4~2.6). status 가 IN_PROGRESS 일 때만 받는다. */
export function sendChatMessage(
    chatSessionId: string,
    messageText: string,
): Promise<ChatTurnResult> {
    return requestChatApi<ChatTurnResult>(
        `/${encodeURIComponent(chatSessionId)}/messages`,
        jsonRequest({ message_text: messageText }),
    );
}
