// fraud_type_confirmed SSE UI 이벤트를 받는 즉시 카드 위에 띄우는 모달.

import catImage from "../../../assets/chatbot/suspicious-transaction-cat-01-150.png";
import dogImage from "../../../assets/chatbot/suspicious-transaction-dog-01-150.png";
import foxImage from "../../../assets/chatbot/suspicious-transaction-fox-01-150.png";
import rabbitImage from "../../../assets/chatbot/suspicious-transaction-rabbit-01-150.png";
import { ACCENT_STRONG } from "../chatbotColors";
import type { FraudTypeCode } from "../chatbotTypes";

const FRAUD_TYPES: Record<
    FraudTypeCode,
    { label: string; icon: string }
> = {
    VOICE_PHISHING: {
        label: "보이스피싱",
        icon: catImage,
    },
    MESSENGER_PHISHING: {
        label: "메신저피싱",
        icon: dogImage,
    },
    ACCOUNT_TAKEOVER: {
        label: "계정탈취",
        icon: foxImage,
    },
    FRAUD_USED_ACCOUNT: {
        label: "사기이용계좌",
        icon: rabbitImage,
    },
};

type FraudAlertModalProps = {
    fraudType: FraudTypeCode;
    message: string;
    onClose: () => void;
};

export function FraudAlertModal({
    fraudType,
    message,
    onClose,
}: FraudAlertModalProps) {
    const info = FRAUD_TYPES[fraudType];

    // 등록되지 않은 유형 코드가 내려오면 아무것도 그리지 않는다.
    if (!info) {
        return null;
    }

    return (
        <div onClick={onClose} style={overlayStyle}>
            {/* 카드 안을 눌렀을 때 오버레이의 닫기까지 올라가지 않게 막는다. */}
            <div
                onClick={(event) => event.stopPropagation()}
                style={dialogStyle}
                role="dialog"
                aria-modal="true"
                aria-label="의심 사기 유형 안내"
            >
                <img src={info.icon} alt={info.label} style={iconStyle} />

                <div style={{ textAlign: "center" }}>
                    <div style={headerStyle}>{message}</div>
                </div>

                <button onClick={onClose} style={confirmButtonStyle}>
                    확인했어요
                </button>
            </div>
        </div>
    );
}

const overlayStyle = {
    position: "absolute" as const,
    inset: 0,
    background: "rgba(40,47,50,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "28px",
    zIndex: 10,
    animation: "fadeIn .2s ease",
};

const dialogStyle = {
    width: "100%",
    background: "var(--color-white)",
    borderRadius: "24px",
    padding: "32px 24px 28px",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "16px",
    boxShadow: "0 20px 48px rgba(0,0,0,0.25)",
    animation: "shieldPop .25s ease",
};

const iconStyle = {
    width: "96px",
    height: "96px",
    borderRadius: "50%",
};

const headerStyle = {
    fontSize: "17px",
    fontWeight: 700,
    color: "var(--color-text-strong)",
    lineHeight: 1.4,
    marginBottom: "8px",
};

const confirmButtonStyle = {
    marginTop: "4px",
    border: "none",
    background: ACCENT_STRONG,
    color: "var(--color-text-strong)",
    fontFamily: "var(--font-brand)",
    fontSize: "14px",
    fontWeight: 600,
    padding: "12px 32px",
    borderRadius: "45px",
    cursor: "pointer",
};
