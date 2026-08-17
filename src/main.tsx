import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { CaseDetailPage } from "./features/caseDetail/CaseDetailPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { QueuePage } from "./features/queue/QueuePage";

function App() {
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
