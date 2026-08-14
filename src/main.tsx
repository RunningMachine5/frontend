import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DashboardPage } from "./features/dashboard/DashboardPage";

function App() {
  return <div>FDS Dashboard Frontend</div>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DashboardPage />
  </StrictMode>,
);
