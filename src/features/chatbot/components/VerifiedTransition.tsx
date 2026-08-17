// 본인인증 성공 뒤 잠시 보여주는 전환 화면. 디자인 원본의 showTransition 블록이다.

export function VerifiedTransition() {
    return (
        <div style={transitionStyle}>
            <svg
                width="76"
                height="88"
                viewBox="0 0 76 88"
                fill="none"
                style={{ animation: "shieldPop .5s ease" }}
            >
                <path
                    d="M38 2L72 14V40C72 62 58 78 38 86C18 78 4 62 4 40V14L38 2Z"
                    fill="var(--color-warning-500)"
                />
                <path
                    d="M38 10L64 19V40C64 58 53 71 38 78C23 71 12 58 12 40V19L38 10Z"
                    fill="var(--color-warning-100)"
                />
                <path
                    d="M27 42L34 49L50 33"
                    stroke="var(--color-warning-600)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>

            <div style={{ textAlign: "center" }}>
                <div style={brandStyle}>FDShield</div>
                <div style={captionStyle}>본인인증이 완료됐어요</div>
            </div>
        </div>
    );
}

const transitionStyle = {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: "18px",
    background: "var(--color-warning-100)",
};

const brandStyle = {
    fontSize: "16px",
    fontWeight: 700,
    color: "var(--color-text-strong)",
    marginBottom: "4px",
};

const captionStyle = {
    fontSize: "13px",
    color: "var(--text-secondary)",
};
