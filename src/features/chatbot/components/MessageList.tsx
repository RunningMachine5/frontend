// 대화 스크롤 영역 — 말풍선, 서버 계약 기반 네/아니요 퀵리플라이, 타이핑 표시.

import type { RefObject } from "react";

import hamsterImage from "../../../assets/chatbot/financial-chatbot-hamster-70.png";
import { ACCENT } from "../chatbotColors";
import type { ChatSizes } from "../chatbotSizes";
import type {
    ChatBubble,
    ChatQuickReply,
    DiscriminationQuestionId,
} from "../chatbotTypes";

type MessageListProps = {
    scrollRef: RefObject<HTMLDivElement | null>;
    bubbles: ChatBubble[];
    isTyping: boolean;
    questionId: DiscriminationQuestionId | null;
    quickReplies: ChatQuickReply[];
    turnBusy: boolean;
    onSelectQuickReply: (reply: ChatQuickReply) => void;
    sizes: ChatSizes;
};

export function MessageList({
    scrollRef,
    bubbles,
    isTyping,
    questionId,
    quickReplies,
    turnBusy,
    onSelectQuickReply,
    sizes,
}: MessageListProps) {
    const avatarSize = { width: sizes.avatarSmall, height: sizes.avatarSmall };
    const bubbleSize = { fontSize: sizes.msgFont, padding: sizes.msgPadding };
    const actionSize = {
        fontSize: sizes.actionFont,
        padding: sizes.actionPadding,
    };

    return (
        <div ref={scrollRef} style={{ ...scrollAreaStyle, gap: sizes.rowGap }}>
            <div style={{ ...dayDividerStyle, fontSize: sizes.dayFont }}>
                오늘
            </div>

            {bubbles.map((bubble) =>
                bubble.fromBot ? (
                    <div key={bubble.key} style={botRowStyle}>
                        <div style={{ ...smallAvatarStyle, ...avatarSize }}>
                            <img src={hamsterImage} alt="" style={imageStyle} />
                        </div>
                        <div style={{ ...botBubbleStyle, ...bubbleSize }}>
                            {bubble.text}
                        </div>
                    </div>
                ) : (
                    <div
                        key={bubble.key}
                        style={{ ...userBubbleStyle, ...bubbleSize }}
                    >
                        {bubble.text}
                    </div>
                ),
            )}

            {isTyping && (
                <div style={typingRowStyle}>
                    <div style={{ ...smallAvatarStyle, ...avatarSize }}>
                        <img src={hamsterImage} alt="" style={imageStyle} />
                    </div>
                    <div style={typingBubbleStyle}>
                        <span style={typingDotStyle(0)} />
                        <span style={typingDotStyle(0.15)} />
                        <span style={typingDotStyle(0.3)} />
                    </div>
                </div>
            )}

            {questionId && quickReplies.length > 0 && !turnBusy && (
                <div
                    key={questionId}
                    style={{
                        ...quickReplyRowStyle,
                        paddingLeft: sizes.actionIndent,
                    }}
                >
                    {quickReplies.map((reply, index) => (
                        <button
                            key={`${questionId}-${reply.action}`}
                            onClick={() => onSelectQuickReply(reply)}
                            aria-label={`${reply.label} 답변`}
                            style={{
                                // 네는 강조하고 아니요는 보조 버튼으로 구분한다.
                                ...(index === 0
                                    ? primaryActionStyle
                                    : secondaryActionStyle),
                                ...actionSize,
                            }}
                        >
                            {reply.label}
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
    background: "var(--color-gray-100)",
};

const dayDividerStyle = {
    alignSelf: "center",
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

// 크기(width/height/fontSize/padding)는 chatbotSizes.ts 의 값으로 덮어쓴다.
const smallAvatarStyle = {
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
    lineHeight: 1.5,
    color: "var(--color-text)",
    whiteSpace: "pre-line" as const,
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
};

const userBubbleStyle = {
    alignSelf: "flex-end",
    maxWidth: "82%",
    background: ACCENT,
    color: "var(--color-text-strong)",
    borderRadius: "16px 4px 16px 16px",
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

// 들여쓰기로 챗봇 말풍선 본문과 시작선을 맞춘다.
const quickReplyRowStyle = {
    display: "flex",
    gap: "8px",
};

const baseActionStyle = {
    fontFamily: "var(--font-brand)",
    borderRadius: "14px",
    cursor: "pointer",
    textAlign: "center" as const,
    flex: 1,
};

const primaryActionStyle = {
    ...baseActionStyle,
    border: "none",
    background: ACCENT,
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
