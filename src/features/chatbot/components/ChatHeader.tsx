// 챗봇 화면 상단 바. 사용하지 않는 우측 알림 버튼은 제거했다.

import hamsterImage from "../../../assets/chatbot/financial-chatbot-hamster-70.png";
import type { ChatSizes } from "../chatbotSizes";

type ChatHeaderProps = {
    sizes: ChatSizes;
};

export function ChatHeader({ sizes }: ChatHeaderProps) {
    return (
        <div style={headerStyle}>
            <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                style={{ flex: "none" }}
                aria-hidden="true"
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
                <img src={hamsterImage} alt="햄주임" style={imageStyle} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...nameStyle, fontSize: sizes.headerFont }}>
                    햄주임
                </div>
                <div style={roleRowStyle}>
                    <span style={onlineDotStyle} />
                    <span style={{ ...roleStyle, fontSize: sizes.subFont }}>
                        금융사기 대처 도우미
                    </span>
                </div>
            </div>
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

const avatarStyle = {
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

const nameStyle = {
    fontWeight: 600,
    color: "var(--color-text-strong)",
};

const roleRowStyle = {
    display: "flex",
    alignItems: "center",
    gap: "5px",
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
