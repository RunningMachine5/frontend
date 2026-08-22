// FREE_TEXT 입력 모드에서만 활성화되는 하단 입력창.

import { useState } from "react";

import { ACCENT } from "../chatbotColors";
import type { ChatSizes } from "../chatbotSizes";
import type {
    ChatConversationPhase,
    ChatInputMode,
    ChatSessionStatus,
} from "../chatbotTypes";

type ChatComposerProps = {
    status: ChatSessionStatus;
    conversationPhase: ChatConversationPhase | null;
    inputMode: ChatInputMode;
    turnBusy: boolean;
    onSend: (text: string) => void;
    sizes: ChatSizes;
};

export function ChatComposer({
    status,
    conversationPhase,
    inputMode,
    turnBusy,
    onSend,
    sizes,
}: ChatComposerProps) {
    const [value, setValue] = useState("");
    const disabled = inputMode !== "FREE_TEXT" || turnBusy;
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
                placeholder={placeholderFor(
                    status,
                    conversationPhase,
                    inputMode,
                    turnBusy,
                )}
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
                    aria-hidden="true"
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

function placeholderFor(
    status: ChatSessionStatus,
    conversationPhase: ChatConversationPhase | null,
    inputMode: ChatInputMode,
    turnBusy: boolean,
): string {
    if (turnBusy) {
        return "처리 중입니다…";
    }
    if (inputMode === "QUICK_REPLY") {
        return "아래의 네/아니요 버튼을 선택해 주세요";
    }
    if (inputMode === "FREE_TEXT") {
        return conversationPhase === "HANDOFF_PENDING"
            ? "전화 대기 중에도 질문할 수 있어요"
            : "메시지를 입력하세요";
    }
    if (conversationPhase === "NORMAL_GUIDE") {
        return "안내가 완료되었습니다";
    }
    if (status === "DONE" || status === "FAILED") {
        return "상담이 종료되었습니다";
    }
    return "잠시만 기다려 주세요";
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
    background: ACCENT,
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
};
