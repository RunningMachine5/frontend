// 챗봇 화면 상단 바. 디자인 원본의 헤더 블록이다.
// 뒤로가기·더보기 아이콘은 원본의 시각 구성이라 그대로 두되 동작은 붙이지 않는다.

import hamsterImage from "../../../assets/chatbot/financial-chatbot-hamster-70.png";

export function ChatHeader() {
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

            <div style={avatarStyle}>
                <img
                    src={hamsterImage}
                    alt="햄주임"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={nameStyle}>햄주임</div>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                    }}
                >
                    <span style={onlineDotStyle} />
                    <span style={roleStyle}>금융사기 대처 도우미</span>
                </div>
            </div>

            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                style={{ flex: "none" }}
            >
                <circle cx="5" cy="12" r="1.6" fill="var(--color-gray-600)" />
                <circle cx="12" cy="12" r="1.6" fill="var(--color-gray-600)" />
                <circle cx="19" cy="12" r="1.6" fill="var(--color-gray-600)" />
            </svg>
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
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    background: "var(--color-warning-100)",
    flex: "none",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
};

const nameStyle = {
    fontSize: "15px",
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
    fontSize: "11.5px",
    color: "var(--text-secondary)",
};
