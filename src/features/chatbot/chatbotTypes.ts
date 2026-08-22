// 고객 대응 챗봇 API 의 응답 타입.
// 백엔드 app/dto/chatbot.py 의 계약을 그대로 옮긴 것이라, 그쪽이 바뀌면 여기도 함께 고친다.

export type { ApiError, ApiResponse } from "../dashboard/dashboardOverviewTypes";

// 세션 생명주기 상태. 실제 대화 단계(conversation_phase)와 분리해서 다룬다.
export type ChatSessionStatus =
    | "URL_SENT"
    | "IN_PROGRESS"
    | "HANDOFF_REQUESTED"
    | "DONE"
    | "FAILED";

export type ChatConversationPhase =
    | "DISCRIMINATION"
    | "FREE_CHAT"
    | "HANDOFF_PENDING"
    | "NORMAL_GUIDE";

export type ChatInputMode = "QUICK_REPLY" | "FREE_TEXT" | "NONE";

export type ChatDiscriminationAction = "ANSWER_YES" | "ANSWER_NO";

export type DiscriminationQuestionId =
    | "OWNERSHIP"
    | "PRIMARY_CHECK"
    | "SECONDARY_CHECK";

export type ChatQuickReply = {
    label: string;
    action: ChatDiscriminationAction;
};

// 백엔드 app/domain/fraud_type_codes.py 의 FINAL_FRAUD_TYPE_CODES 4종.
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
    conversation_phase: ChatConversationPhase | null;
    input_mode: ChatInputMode;
    question_id: DiscriminationQuestionId | null;
    quick_replies: ChatQuickReply[];
    confirmed_fraud_type: FraudTypeCode | null;
    messages: ChatMessage[];
};

// POST /chat/{id}/discrimination-actions, POST /chat/{id}/messages 의 응답.
// messages 는 이번 턴에 챗봇이 보낸 본문만 담는다(누적 이력이 아니다).
export type ChatTurnResult = {
    chat_session_id: string;
    status: ChatSessionStatus;
    question_step: number;
    conversation_phase: ChatConversationPhase | null;
    input_mode: ChatInputMode;
    question_id: DiscriminationQuestionId | null;
    quick_replies: ChatQuickReply[];
    confirmed_fraud_type: FraudTypeCode | null;
    messages: string[];
};

export type FraudTypeConfirmedEvent = {
    event: "fraud_type_confirmed";
    confirmed_fraud_type: FraudTypeCode;
    message: string;
};

// 화면이 그리는 말풍선 하나.
// 서버 이력(ChatMessage)과 아직 저장 확인 전인 낙관적 말풍선을 같은 형태로 다룬다.
export type ChatBubble = {
    key: string;
    fromBot: boolean;
    text: string;
};
