// 고객 대응 챗봇 화면 (/chat/:chatSessionId).
// 흐름은 PRD 2.2~2.6, 화면 골격은 디자인 원본 Chat.dc.html 의 390x844 카드다.

import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";

import { chatSizes } from "./chatbotSizes";
import { ChatComposer } from "./components/ChatComposer";
import { ChatHeader } from "./components/ChatHeader";
import { IdentityGate } from "./components/IdentityGate";
import { MessageList } from "./components/MessageList";
import { VerifiedTransition } from "./components/VerifiedTransition";
import { useChatSession } from "./useChatSession";

export function ChatbotPage() {
    const { chatSessionId } = useParams<{ chatSessionId: string }>();

    if (!chatSessionId) {
        return <ChatFrame>{<NoticeScreen text="잘못된 접속 주소입니다." />}</ChatFrame>;
    }

    return <ChatbotSession chatSessionId={chatSessionId} />;
}

function ChatbotSession({ chatSessionId }: { chatSessionId: string }) {
    const {
        phase,
        status,
        isOlder,
        bubbles,
        verifyBusy,
        verifyError,
        isTyping,
        turnError,
        verify,
        selectAction,
        sendAnswer,
    } = useChatSession(chatSessionId);

    const scrollRef = useRef<HTMLDivElement>(null);

    // 고령자 세션이면 글씨·여백·버튼을 한 단계 키운다(PRD 2.2 의 is_older).
    // 인증 전에는 is_older 를 모르므로 본인인증 화면은 기본 크기 그대로다.
    const sizes = chatSizes(isOlder);

    // 말풍선이 늘거나 대기 표시가 바뀔 때마다 맨 아래로 내린다.
    useEffect(() => {
        const element = scrollRef.current;
        if (element) {
            element.scrollTop = element.scrollHeight;
        }
    }, [bubbles, isTyping, status]);

    if (phase === "NOT_FOUND") {
        return (
            <ChatFrame>
                <NoticeScreen text="채팅 세션을 찾을 수 없습니다. 안내 메일의 링크를 다시 확인해 주세요." />
            </ChatFrame>
        );
    }

    if (phase === "GATE") {
        return (
            <ChatFrame>
                <IdentityGate
                    busy={verifyBusy}
                    errorMessage={verifyError}
                    onVerify={verify}
                />
            </ChatFrame>
        );
    }

    if (phase === "TRANSITION") {
        return (
            <ChatFrame>
                <VerifiedTransition />
            </ChatFrame>
        );
    }

    return (
        <ChatFrame>
            <ChatHeader sizes={sizes} />

            <MessageList
                scrollRef={scrollRef}
                bubbles={bubbles}
                isTyping={isTyping}
                // 버튼은 최초 알림 직후에만 받는다. 누르는 순간 SUBMITTING 이 되어 사라진다.
                showActions={status === "URL_SENT"}
                onSelectAction={selectAction}
                sizes={sizes}
            />

            {turnError && (
                <div style={{ ...turnErrorStyle, fontSize: sizes.noteFont }}>
                    {turnError}
                </div>
            )}

            <ChatComposer
                status={status}
                isTyping={isTyping}
                onSend={sendAnswer}
                sizes={sizes}
            />
        </ChatFrame>
    );
}

/** 390x844 모바일 카드. 디자인 원본의 바깥 두 겹을 그대로 옮겼다. */
function ChatFrame({ children }: { children: React.ReactNode }) {
    return (
        <div style={pageStyle}>
            <div style={cardStyle}>{children}</div>
        </div>
    );
}

function NoticeScreen({ text }: { text: string }) {
    return <div style={noticeStyle}>{text}</div>;
}

const pageStyle = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px",
    boxSizing: "border-box" as const,
    background: "var(--color-gray-100)",
    fontFamily: "var(--font-brand)",
};

const cardStyle = {
    width: "390px",
    height: "844px",
    background: "var(--color-white)",
    borderRadius: "32px",
    overflow: "hidden",
    boxShadow: "0 24px 64px rgba(40,47,50,0.18)",
    display: "flex",
    flexDirection: "column" as const,
    position: "relative" as const,
};

const noticeStyle = {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px",
    textAlign: "center" as const,
    fontSize: "14px",
    lineHeight: 1.6,
    color: "var(--text-secondary)",
};

const turnErrorStyle = {
    flex: "none",
    padding: "10px 16px",
    background: "var(--color-danger-100)",
    color: "var(--color-danger-700)",
    lineHeight: 1.5,
    textAlign: "center" as const,
};
