// 라우트 정의. 챗봇 접속 URL 은 백엔드가 메일에 넣는 /chat/{chat_session_id} 다.

import { Navigate, Route, Routes } from "react-router-dom";

import { ChatbotPage } from "./features/chatbot/ChatbotPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";

export function App() {
    return (
        <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/chat/:chatSessionId" element={<ChatbotPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
