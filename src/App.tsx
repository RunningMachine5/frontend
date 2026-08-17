// 라우트 정의.
//
// 챗봇은 경로 라우트다. 접속 URL 을 백엔드가 메일에 넣는데(CHAT_BASE_URL +
// /chat/{chat_session_id}) 해시로는 그 주소를 받을 수 없다.
//
// 담당자 화면(대시보드·처리 페이지·이상거래 분석)은 기존 해시 내비게이션을 그대로 둔다.
// AppLayout 의 링크와 CaseDetailPage 의 거래 id 추출이 모두 해시 기반이라, 경로 라우트로
// 옮기려면 그 화면들을 함께 고쳐야 해서 이 머지의 범위를 넘는다.

import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { CaseDetailPage } from "./features/caseDetail/CaseDetailPage";
import { ChatbotPage } from "./features/chatbot/ChatbotPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { QueuePage } from "./features/queue/QueuePage";

/** 해시(#queue, #case/{id})로 갈리는 담당자 화면들. */
function MonitoringPages() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  if (hash.startsWith("#case/")) return <CaseDetailPage />;
  if (hash === "#queue") return <QueuePage />;
  return <DashboardPage />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<MonitoringPages />} />
      <Route path="/chat/:chatSessionId" element={<ChatbotPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
