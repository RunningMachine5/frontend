// 사기 유형 알림 모달. 헤더의 알림 버튼을 누르면 카드 위에 덮어 뜬다.
// 디자인 원본 Chat.dc.html 의 showAlertModal 블록이다.

import catImage from "../../../assets/chatbot/suspicious-transaction-cat-01-150.png";
import dogImage from "../../../assets/chatbot/suspicious-transaction-dog-01-150.png";
import foxImage from "../../../assets/chatbot/suspicious-transaction-fox-01-150.png";
import rabbitImage from "../../../assets/chatbot/suspicious-transaction-rabbit-01-150.png";
import { ACCENT_STRONG } from "../chatbotColors";
import type { FraudTypeCode } from "../chatbotTypes";

// 유형별 아이콘과 문구. 말풍선이 아니라 화면 고정 문구라 백엔드가 내려주지 않는다
// (버튼 라벨을 MessageList 가 상수로 들고 있는 것과 같은 이유다).
const FRAUD_TYPES: Record<
    FraudTypeCode,
    { label: string; icon: string; header: string }
> = {
    VOICE_PHISHING: {
        label: "보이스피싱",
        icon: catImage,
        header: "현재 보이스피싱이 의심되는 상황이에요",
    },
    MESSENGER_PHISHING: {
        label: "메신저피싱",
        icon: dogImage,
        header: "현재 메신저피싱이 의심되는 상황이에요",
    },
    ACCOUNT_TAKEOVER: {
        label: "계정탈취",
        icon: foxImage,
        header: "현재 계정탈취가 의심되는 상황이에요",
    },
    FRAUD_USED_ACCOUNT: {
        label: "사기이용계좌",
        icon: rabbitImage,
        header: "현재 사기이용계좌가 의심되는 상황이에요",
    },
};

// 네 유형이 같은 안내를 쓴다.
const ALERT_BODY = "관련된 정보를 물어봐주시면 더 자세히 답변해드릴게요";

type FraudAlertModalProps = {
    fraudType: FraudTypeCode;
    onClose: () => void;
};

export function FraudAlertModal({ fraudType, onClose }: FraudAlertModalProps) {
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
            >
                <img src={info.icon} alt={info.label} style={iconStyle} />

                <div style={{ textAlign: "center" }}>
                    <div style={headerStyle}>{info.header}</div>
                    <div style={bodyStyle}>{ALERT_BODY}</div>
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

const bodyStyle = {
    fontSize: "13.5px",
    lineHeight: 1.5,
    color: "var(--text-secondary)",
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
