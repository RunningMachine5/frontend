// 챗봇 화면 상단 바. 디자인 원본의 헤더 블록이다.
// 뒤로가기 아이콘은 원본의 시각 구성이라 그대로 두되 동작은 붙이지 않는다.
// 우측은 사기 유형 알림 버튼이며, 유형이 잡힌 세션에서만 빨간 점이 점등된다.

import hamsterImage from "../../../assets/chatbot/financial-chatbot-hamster-70.png";
import type { ChatSizes } from "../chatbotSizes";
import type { FraudTypeCode } from "../chatbotTypes";

type ChatHeaderProps = {
    sizes: ChatSizes;
    /** 의심 사기 유형. null 이면 알림 버튼이 꺼진 상태다. */
    fraudType: FraudTypeCode | null;
    onOpenAlert: () => void;
};

export function ChatHeader({
    sizes,
    fraudType,
    onOpenAlert,
}: ChatHeaderProps) {
    const alerting = fraudType !== null;

    return (
        <div style={headerStyle}>
            <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                style={{ flex: "none" }}
            >
                <path
                    d="M15 5L8 12L15 19"
                    stroke="var(--color-text)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>

            <div
                style={{
                    ...avatarStyle,
                    width: sizes.avatar,
                    height: sizes.avatar,
                }}
            >
                <img
                    src={hamsterImage}
                    alt="햄주임"
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                    }}
                />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...nameStyle, fontSize: sizes.headerFont }}>
                    햄주임
                </div>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                    }}
                >
                    <span style={onlineDotStyle} />
                    <span style={{ ...roleStyle, fontSize: sizes.subFont }}>
                        금융사기 대처 도우미
                    </span>
                </div>
            </div>

            <button
                onClick={onOpenAlert}
                disabled={!alerting}
                aria-label="의심 사기 유형 안내"
                style={{
                    ...alertButtonStyle,
                    background: alerting
                        ? "var(--color-danger-100)"
                        : "var(--color-gray-100)",
                    boxShadow: alerting
                        ? "0 0 0 1px var(--color-danger-200)"
                        : "none",
                    cursor: alerting ? "pointer" : "default",
                }}
            >
                <span
                    style={{
                        ...alertDotStyle,
                        background: alerting
                            ? "var(--color-danger-500)"
                            : "var(--color-gray-400)",
                        animation: alerting
                            ? "alertPulse 1.6s infinite"
                            : "none",
                    }}
                />
            </button>
        </div>
    );
}

const headerStyle = {
    flex: "none",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "16px 18px",
    borderBottom: "1px solid var(--color-border)",
    background: "var(--color-white)",
};

// 크기(width/height/fontSize)는 chatbotSizes.ts 의 값으로 덮어쓴다.
const avatarStyle = {
    borderRadius: "50%",
    background: "var(--color-warning-100)",
    flex: "none",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
};

const nameStyle = {
    fontWeight: 600,
    color: "var(--color-text-strong)",
};

const onlineDotStyle = {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "var(--color-success-500)",
    flex: "none",
};

const roleStyle = {
    color: "var(--text-secondary)",
};

// 배경·그림자·커서는 사기 유형 유무에 따라 위에서 덮어쓴다.
const alertButtonStyle = {
    flex: "none",
    width: "26px",
    height: "26px",
    borderRadius: "50%",
    border: "none",
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background .2s, box-shadow .2s",
};

const alertDotStyle = {
    width: "9px",
    height: "9px",
    borderRadius: "50%",
};
