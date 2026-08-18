// 라우트 정의.
//
// 챗봇은 경로 라우트다. 접속 URL 을 백엔드가 메일에 넣는데(CHAT_BASE_URL +
// /chat/{chat_session_id}) 해시로는 그 주소를 받을 수 없다.
//
// 담당자 화면(대시보드·처리 페이지·이상거래 분석)은 기존 해시 내비게이션을 그대로 둔다.
// 상세 화면에서 선택한 거래 ID는 sessionStorage에 보관하고 URL은 #case로 유지한다.

import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { CaseDetailPage } from "./features/caseDetail/CaseDetailPage";
import { ChatbotPage } from "./features/chatbot/ChatbotPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { ModelManagementPage } from "./features/mlops/ModelManagementPage";
import { QueuePage } from "./features/queue/QueuePage";
import { RuleManagementPage } from "./features/rules/RuleManagementPage";

/** 해시(#queue, #case)로 갈리는 담당자 화면들. */
function MonitoringPages() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  if (hash === "#case") return <CaseDetailPage />;
  if (hash === "#queue") return <QueuePage />;
  if (hash === "#rules") return <RuleManagementPage />;
  if (hash === "#model") return <ModelManagementPage />;
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
