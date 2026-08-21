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

export type ChatMessageSnapshot = {
    message_index: number;
    message_text: string;
};

type SendChatMessageOptions = {
    onSnapshot: (snapshot: ChatMessageSnapshot) => void;
    signal?: AbortSignal;
};

type SseEvent = {
    event: string;
    data: unknown;
};

/**
 * 고객 답변 한 건을 POST하고 SSE 스트림을 소비한다(PRD 2.4~2.6).
 * EventSource는 POST 본문을 보낼 수 없으므로 fetch의 ReadableStream을 직접 읽는다.
 */
export async function sendChatMessage(
    chatSessionId: string,
    messageText: string,
    options: SendChatMessageOptions,
): Promise<ChatTurnResult> {
    let response: Response;

    try {
        response = await fetch(
            `${CHAT_API_BASE}/${encodeURIComponent(chatSessionId)}/messages`,
            {
                ...jsonRequest({ message_text: messageText }),
                signal: options.signal,
            },
        );
    } catch {
        throw new ChatApiError(0, "서버에 연결하지 못했습니다.");
    }

    if (!response.ok) {
        let result: ApiResponse<never> | null = null;
        try {
            result = (await response.json()) as ApiResponse<never>;
        } catch {
            result = null;
        }
        throw new ChatApiError(
            response.status,
            result?.error?.message ?? "요청을 처리하지 못했습니다.",
        );
    }

    if (!response.body) {
        throw new ChatApiError(response.status, "응답 스트림을 읽을 수 없습니다.");
    }

    let completed: ChatTurnResult | null = null;
    await consumeSseStream(response.body, (message) => {
        if (message.event === "chat_message_snapshot") {
            options.onSnapshot(message.data as ChatMessageSnapshot);
            return;
        }
        if (message.event === "chat_turn_completed") {
            completed = message.data as ChatTurnResult;
            return;
        }
        if (message.event === "chat_turn_error") {
            const error = message.data as { message?: string };
            throw new ChatApiError(
                response.status,
                error.message ?? "챗봇 응답을 생성하지 못했습니다.",
            );
        }
    });

    if (!completed) {
        throw new ChatApiError(
            response.status,
            "챗봇 응답이 완료되기 전에 연결이 종료되었습니다.",
        );
    }
    return completed;
}

async function consumeSseStream(
    body: ReadableStream<Uint8Array>,
    onEvent: (event: SseEvent) => void,
): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });

        let boundary = findSseBoundary(buffer);
        while (boundary) {
            const block = buffer.slice(0, boundary.index);
            buffer = buffer.slice(boundary.index + boundary.length);
            dispatchSseBlock(block, onEvent);
            boundary = findSseBoundary(buffer);
        }

        if (done) {
            break;
        }
    }

    // 정상 서버 응답은 빈 줄로 끝나지만, 연결 종료 직전 마지막 이벤트도 복구한다.
    if (buffer.trim()) {
        dispatchSseBlock(buffer, onEvent);
    }
}

function findSseBoundary(buffer: string): { index: number; length: number } | null {
    const match = /\r?\n\r?\n/.exec(buffer);
    return match ? { index: match.index, length: match[0].length } : null;
}

function dispatchSseBlock(
    rawBlock: string,
    onEvent: (event: SseEvent) => void,
): void {
    const lines = rawBlock.replaceAll("\r\n", "\n").split("\n");
    let event = "message";
    const dataLines: string[] = [];

    for (const line of lines) {
        if (!line || line.startsWith(":")) {
            continue;
        }
        if (line.startsWith("event:")) {
            event = line.slice("event:".length).trimStart();
        } else if (line.startsWith("data:")) {
            dataLines.push(line.slice("data:".length).trimStart());
        }
    }

    if (dataLines.length === 0) {
        return;
    }

    try {
        onEvent({ event, data: JSON.parse(dataLines.join("\n")) as unknown });
    } catch (error) {
        if (error instanceof ChatApiError) {
            throw error;
        }
        throw new ChatApiError(200, "챗봇 응답 형식을 해석하지 못했습니다.");
    }
}
