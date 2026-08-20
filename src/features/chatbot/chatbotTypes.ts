// 고객 대응 챗봇 API 의 응답 타입.
// 백엔드 app/dto/chatbot.py 의 계약을 그대로 옮긴 것이라, 그쪽이 바뀌면 여기도 함께 고친다.

export type { ApiError, ApiResponse } from "../dashboard/dashboardOverviewTypes";

// 스키마 3.3 의 ChatSessionStatus 5종.
export type ChatSessionStatus =
    | "URL_SENT"
    | "IN_PROGRESS"
    | "HANDOFF_REQUESTED"
    | "DONE"
    | "FAILED";

// 화면에서만 쓰는 상태. 버튼을 누른 뒤 응답이 오기 전까지의 구간이며 서버에는 없다.
// 버튼을 즉시 감춰 더블클릭으로 409 가 나는 것을 막는다.
export type ChatViewStatus = ChatSessionStatus | "SUBMITTING";

// 최초 알림 뒤 고객이 선택할 수 있는 버튼 3종 (PRD 2.3).
export type ChatButtonAction = "START_CHAT" | "REQUEST_HANDOFF" | "END_CHAT";

// 백엔드 app/domain/fraud_type_codes.py 의 FINAL_FRAUD_TYPE_CODES 4종.
// 헤더 알림 버튼과 사기 유형 알림 모달이 이 코드로 문구·아이콘을 고른다.
export type FraudTypeCode =
    | "VOICE_PHISHING"
    | "MESSENGER_PHISHING"
    | "ACCOUNT_TAKEOVER"
    | "FRAUD_USED_ACCOUNT";

export type ChatMessageSender = "AI" | "HUMAN" | "SYSTEM";

export type ChatMessage = {
    message_id: number;
    sender_type: ChatMessageSender;
    message_text: string;
    sent_at: string;
};

// POST /chat/{id}/verify, GET /chat/{id} 의 응답. messages 는 누적 이력이다.
export type ChatSessionDetail = {
    chat_session_id: string;
    transaction_id: number;
    status: ChatSessionStatus;
    // 참이면 고령자 대상이다. 챗봇 화면의 글씨·여백·버튼을 키우는 데 쓴다(chatbotSizes.ts).
    is_older: boolean;
    question_step: number;
    // 이 상담에서 의심되는 사기 유형. 아직 백엔드 계약에 없는 선택 필드다.
    // 내려오기 시작하면 헤더 알림 버튼이 점등되고, 없으면 알림 버튼은 꺼진 채로 있는다.
    fraud_type?: FraudTypeCode | null;
    messages: ChatMessage[];
};

// POST /chat/{id}/actions, POST /chat/{id}/messages 의 응답.
// messages 는 이번 턴에 챗봇이 보낸 본문만 담는다(누적 이력이 아니다).
export type ChatTurnResult = {
    chat_session_id: string;
    status: ChatSessionStatus;
    question_step: number;
    // 턴을 돌면서 유형이 좁혀질 수 있어 상세 조회와 같은 선택 필드를 둔다.
    fraud_type?: FraudTypeCode | null;
    messages: string[];
};

// 화면이 그리는 말풍선 하나.
// 서버 이력(ChatMessage)과 아직 저장 확인 전인 낙관적 말풍선을 같은 형태로 다룬다.
export type ChatBubble = {
    key: string;
    fromBot: boolean;
    text: string;
};
