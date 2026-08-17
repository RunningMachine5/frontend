import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const BACKEND_TARGET = "http://localhost:8000";

// 챗봇 API 는 백엔드에서 /chat, /agent 지만 프론트는 /api/chat, /api/agent 로 부른다.
// 고객이 브라우저로 여는 챗봇 화면 주소가 /chat/{chat_session_id} 라서, /chat 을 그대로
// 프록시하면 화면 대신 API 응답이 내려온다. Vite 는 키 순서대로 매칭하므로 좁은 규칙을 먼저 둔다.
const stripApiPrefix = (path: string) => path.replace(/^\/api/, "");

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/chat": {
        target: BACKEND_TARGET,
        changeOrigin: true,
        rewrite: stripApiPrefix
      },
      "/api/agent": {
        target: BACKEND_TARGET,
        changeOrigin: true,
        rewrite: stripApiPrefix
      },
      // 대시보드는 백엔드 경로도 /api/dashboard 라 재작성하지 않는다.
      "/api": {
        target: BACKEND_TARGET,
        changeOrigin: true
      },
      // 처리 페이지·이상거래 분석 화면이 /api 없이 부르는 거래 조회 경로.
      "/transactions": {
        target: BACKEND_TARGET,
        changeOrigin: true
      }
    }
  }
});
