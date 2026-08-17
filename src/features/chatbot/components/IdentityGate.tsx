// 출생연도 4자리 본인인증 화면 (PRD 2.2). 디자인 원본 Chat.dc.html 의 showGate 블록이다.

import { useState } from "react";

import hamsterImage from "../../../assets/chatbot/financial-chatbot-hamster-70.png";

type IdentityGateProps = {
    busy: boolean;
    errorMessage: string | null;
    onVerify: (birthYear: string) => void;
};

export function IdentityGate({
    busy,
    errorMessage,
    onVerify,
}: IdentityGateProps) {
    const [birthYear, setBirthYear] = useState("");

    // 422 를 서버까지 보내지 않도록 숫자 4자리만 남긴다.
    const isReady = birthYear.length === 4;
    const disabled = !isReady || busy;

    function submit() {
        if (disabled) {
            return;
        }
        onVerify(birthYear);
    }

    return (
        <div style={gateStyle}>
            <div style={avatarStyle}>
                <img src={hamsterImage} alt="햄주임" style={imageStyle} />
            </div>

            <div style={{ textAlign: "center" }}>
                <div style={titleStyle}>본인인증</div>
                <div style={descriptionStyle}>
                    안전한 상담을 위해 출생연도 4자리를
                    <br />
                    입력해 주세요
                </div>
            </div>

            <input
                value={birthYear}
                onChange={(event) =>
                    setBirthYear(
                        event.target.value.replace(/\D/g, "").slice(0, 4),
                    )
                }
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        submit();
                    }
                }}
                placeholder="예: 1958"
                inputMode="numeric"
                maxLength={4}
                disabled={busy}
                style={{
                    ...inputStyle,
                    border: `1.5px solid ${
                        errorMessage
                            ? "var(--color-danger-500)"
                            : "var(--color-border)"
                    }`,
                }}
            />

            {errorMessage && <div style={errorStyle}>{errorMessage}</div>}

            <button
                onClick={submit}
                disabled={disabled}
                style={{ ...buttonStyle, opacity: disabled ? 0.55 : 1 }}
            >
                {busy ? "확인 중…" : "확인"}
            </button>
        </div>
    );
}

const gateStyle = {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    gap: "20px",
    padding: "32px",
    background: "var(--color-white)",
};

const avatarStyle = {
    width: "72px",
    height: "72px",
    borderRadius: "50%",
    background: "var(--color-warning-100)",
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

const titleStyle = {
    fontSize: "18px",
    fontWeight: 600,
    color: "var(--color-text-strong)",
    marginBottom: "6px",
};

const descriptionStyle = {
    fontSize: "13px",
    lineHeight: 1.5,
    color: "var(--text-secondary)",
};

const inputStyle = {
    width: "160px",
    textAlign: "center" as const,
    letterSpacing: "4px",
    fontSize: "20px",
    fontWeight: 600,
    background: "var(--color-gray-100)",
    borderRadius: "14px",
    padding: "14px 10px",
    fontFamily: "var(--font-brand)",
    color: "var(--color-text)",
    outline: "none",
};

const errorStyle = {
    fontSize: "12.5px",
    color: "var(--color-danger-600)",
    marginTop: "-10px",
    textAlign: "center" as const,
};

const buttonStyle = {
    width: "100%",
    maxWidth: "220px",
    border: "none",
    background: "var(--color-primary-200)",
    color: "var(--color-text-strong)",
    fontFamily: "var(--font-brand)",
    fontSize: "14.5px",
    fontWeight: 600,
    padding: "14px",
    borderRadius: "45px",
    cursor: "pointer",
};
