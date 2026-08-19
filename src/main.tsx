import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./App";

// 디자인 시스템 토큰. 값은 원본 그대로이며 챗봇 화면이 var(--color-*) 로 참조한다.
import "./styles/tokens/fonts.css";
import "./styles/tokens/colors.css";
import "./styles/tokens/effects.css";
import "./styles/tokens/spacing.css";
import "./styles/global.css";
import "./styles/chatbot.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
