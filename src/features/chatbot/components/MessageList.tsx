// 대화 스크롤 영역 — 말풍선, 버튼 3종, 타이핑 표시.
// 디자인 원본의 스크롤 블록이며, 목 데이터로 돌던 퀵리플라이는 대응 API 가 없어 옮기지 않았다.

import type { RefObject } from "react";

import hamsterImage from "../../../assets/chatbot/financial-chatbot-hamster-70.png";
import type { ChatBubble, ChatButtonAction } from "../chatbotTypes";

// 라벨은 PRD 2.3 의 버튼 이름을 쓴다. 문구를 내려주는 API 가 없어 프론트 상수로 둔다.
const ACTION_BUTTONS: { action: ChatButtonAction; label: string }[] = [
    { action: "START_CHAT", label: "챗봇 상담" },
    { action: "REQUEST_HANDOFF", label: "상담사 연결" },
    { action: "END_CHAT", label: "종료" },
];

type MessageListProps = {
    scrollRef: RefObject<HTMLDivElement | null>;
    bubbles: ChatBubble[];
    isTyping: boolean;
    showActions: boolean;
    onSelectAction: (action: ChatButtonAction) => void;
};

export function MessageList({
    scrollRef,
    bubbles,
    isTyping,
    showActions,
    onSelectAction,
}: MessageListProps) {
    return (
        <div ref={scrollRef} style={scrollAreaStyle}>
            <div style={dayDividerStyle}>오늘</div>

            {bubbles.map((bubble) =>
                bubble.fromBot ? (
                    <div key={bubble.key} style={botRowStyle}>
                        <div style={smallAvatarStyle}>
                            <img src={hamsterImage} alt="" style={imageStyle} />
                        </div>
                        <div style={botBubbleStyle}>{bubble.text}</div>
                    </div>
                ) : (
                    <div key={bubble.key} style={userBubbleStyle}>
                        {bubble.text}
                    </div>
                ),
            )}

            {isTyping && (
                <div style={typingRowStyle}>
                    <div style={smallAvatarStyle}>
                        <img src={hamsterImage} alt="" style={imageStyle} />
                    </div>
                    <div style={typingBubbleStyle}>
                        <span style={typingDotStyle(0)} />
                        <span style={typingDotStyle(0.15)} />
                        <span style={typingDotStyle(0.3)} />
                    </div>
                </div>
            )}

            {showActions && (
                <div style={actionColumnStyle}>
                    {ACTION_BUTTONS.map(({ action, label }, index) => (
                        <button
                            key={action}
                            onClick={() => onSelectAction(action)}
                            style={
                                // 첫 버튼(챗봇 상담)만 강조색이다.
                                index === 0
                                    ? primaryActionStyle
                                    : secondaryActionStyle
                            }
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

const scrollAreaStyle = {
    flex: 1,
    overflowY: "auto" as const,
    padding: "18px 16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "14px",
    background: "var(--color-gray-100)",
};

const dayDividerStyle = {
    alignSelf: "center",
    fontSize: "11px",
    color: "var(--color-gray-500)",
    background: "var(--color-gray-200)",
    padding: "4px 12px",
    borderRadius: "20px",
    flex: "none",
};

const botRowStyle = {
    display: "flex",
    gap: "8px",
    alignItems: "flex-end",
    maxWidth: "88%",
};

const typingRowStyle = {
    display: "flex",
    gap: "8px",
    alignItems: "flex-end",
};

const smallAvatarStyle = {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background: "var(--color-warning-100)",
    flex: "none",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
};

const imageStyle = {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
};

const botBubbleStyle = {
    background: "var(--color-white)",
    border: "1px solid var(--color-border)",
    borderRadius: "4px 16px 16px 16px",
    padding: "11px 14px",
    fontSize: "14px",
    lineHeight: 1.5,
    color: "var(--color-text)",
    whiteSpace: "pre-line" as const,
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
};

const userBubbleStyle = {
    alignSelf: "flex-end",
    maxWidth: "82%",
    background: "var(--color-primary-200)",
    color: "var(--color-text-strong)",
    borderRadius: "16px 4px 16px 16px",
    padding: "11px 14px",
    fontSize: "14px",
    lineHeight: 1.5,
    whiteSpace: "pre-line" as const,
};

const typingBubbleStyle = {
    background: "var(--color-white)",
    border: "1px solid var(--color-border)",
    borderRadius: "4px 16px 16px 16px",
    padding: "13px 16px",
    display: "flex",
    gap: "4px",
};

function typingDotStyle(delaySeconds: number) {
    return {
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        background: "var(--color-gray-400)",
        animation: `typingDot 1.1s infinite ${delaySeconds}s`,
    };
}

// 말풍선 본문과 세로선을 맞춘다(아바타 28px + 간격 8px).
const actionColumnStyle = {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
    paddingLeft: "36px",
};

const baseActionStyle = {
    fontFamily: "var(--font-brand)",
    fontSize: "13.5px",
    padding: "11px 16px",
    borderRadius: "14px",
    cursor: "pointer",
    textAlign: "left" as const,
};

const primaryActionStyle = {
    ...baseActionStyle,
    border: "none",
    background: "var(--color-primary-200)",
    color: "var(--color-text-strong)",
    fontWeight: 600,
};

const secondaryActionStyle = {
    ...baseActionStyle,
    border: "1px solid var(--color-border)",
    background: "var(--color-white)",
    color: "var(--color-text)",
    fontWeight: 500,
};
