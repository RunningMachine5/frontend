// 입력창과 전송 버튼. 디자인 원본의 하단 입력줄이다.
// PRD 2.3 대로 상담이 시작되기 전(URL_SENT)과 끝난 뒤에는 입력을 막는다.

import { useState } from "react";

import type { ChatSizes } from "../chatbotSizes";
import type { ChatViewStatus } from "../chatbotTypes";

// 상태별 안내. 디자인 원본의 placeholders 맵을 그대로 옮겼다.
const PLACEHOLDERS: Record<ChatViewStatus, string> = {
    URL_SENT: "위에서 옵션을 선택해 주세요",
    SUBMITTING: "처리 중입니다…",
    IN_PROGRESS: "메시지를 입력하세요",
    HANDOFF_REQUESTED: "상담원 연결 대기 중입니다",
    DONE: "상담이 종료되었습니다",
    // 메일 발송에 실패해 남은 세션. 고객이 닿는 경우는 드물지만 입력은 막는다.
    FAILED: "상담이 종료되었습니다",
};

type ChatComposerProps = {
    status: ChatViewStatus;
    isTyping: boolean;
    onSend: (text: string) => void;
    sizes: ChatSizes;
};

export function ChatComposer({
    status,
    isTyping,
    onSend,
    sizes,
}: ChatComposerProps) {
    const [value, setValue] = useState("");

    const disabled = status !== "IN_PROGRESS" || isTyping;
    const opacity = disabled ? 0.55 : 1;

    function send() {
        if (disabled || !value.trim()) {
            return;
        }
        onSend(value);
        setValue("");
    }

    return (
        <div style={composerStyle}>
            <input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        send();
                    }
                }}
                placeholder={PLACEHOLDERS[status]}
                disabled={disabled}
                style={{
                    ...inputStyle,
                    fontSize: sizes.inputFont,
                    padding: sizes.inputPadding,
                    opacity,
                }}
            />

            <button
                onClick={send}
                disabled={disabled}
                aria-label="전송"
                style={{
                    ...sendButtonStyle,
                    width: sizes.sendSize,
                    height: sizes.sendSize,
                    opacity,
                }}
            >
                <svg
                    width={sizes.sendIcon}
                    height={sizes.sendIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                >
                    <path
                        d="M4 12L20 4L14 20L11 13L4 12Z"
                        fill="var(--color-text-strong)"
                    />
                </svg>
            </button>
        </div>
    );
}

const composerStyle = {
    flex: "none",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 14px",
    borderTop: "1px solid var(--color-border)",
    background: "var(--color-white)",
};

// 크기(width/height/fontSize/padding)는 chatbotSizes.ts 의 값으로 덮어쓴다.
const inputStyle = {
    flex: 1,
    border: "none",
    background: "var(--color-gray-100)",
    borderRadius: "45px",
    fontFamily: "var(--font-brand)",
    color: "var(--color-text)",
    outline: "none",
    minWidth: 0,
};

const sendButtonStyle = {
    flex: "none",
    borderRadius: "50%",
    background: "var(--color-primary-200)",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
};
