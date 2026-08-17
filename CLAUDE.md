# CLAUDE.md

FDShield(이상거래 탐지) 프론트엔드. React 19 + TypeScript + Vite, 빌드 도구 외 런타임
라이브러리는 `react-router-dom` 하나뿐이다. 상태관리·데이터페칭·UI 라이브러리를 쓰지 않는다.

## 명령어

```bash
npm run dev       # 개발 서버 5173 (--host 0.0.0.0)
npm run build     # tsc -b 타입 체크 후 프로덕션 빌드
npm run preview   # 빌드 결과 4173 — /api 프록시가 없어 API 호출은 실패한다
```

테스트 러너와 린터는 아직 없다. **변경 후 검증은 `npm run build`다** — `tsc -b`가 붙어 있어
타입 오류를 잡는다.

## 백엔드 연동

백엔드는 별도 레포 `../backend`(FastAPI, `http://localhost:8000`)다.
프론트는 백엔드 주소를 직접 부르지 않고 [vite.config.ts](vite.config.ts)의 프록시를 거친다.

| 프론트 호출 | 백엔드 경로 | 비고 |
| --- | --- | --- |
| `/api/dashboard/*` | `/api/dashboard/*` | 재작성 없음 |
| `/api/chat/*` | `/chat/*` | `/api` 를 떼고 넘긴다 |
| `/api/agent/*` | `/agent/*` | `/api` 를 떼고 넘긴다 |

**`/chat` 을 그대로 프록시하면 안 된다.** 고객이 브라우저로 여는 챗봇 화면 주소가
`/chat/{chat_session_id}` 라서 프록시와 충돌한다. 그래서 챗봇 API만 `/api` 접두어를 붙여
호출하고 프록시에서 떼어낸다. Vite 프록시는 키 순서대로 매칭하므로 **좁은 규칙
(`/api/chat`, `/api/agent`)이 `/api` 보다 먼저** 있어야 한다.

백엔드 `.env` 의 `CHAT_BASE_URL` 은 이 프론트 주소(`http://localhost:5173`)여야 한다.
기본값은 백엔드 자신(`http://localhost:8000`)이라 그대로 두면 메일 링크가 챗봇 화면으로
오지 않는다.

### 응답 봉투

모든 API가 공통 봉투를 쓴다. `data` 만 꺼내 쓰고, 봉투 해제는 각 기능의 `*Api.ts` 가 한다.

```ts
type ApiResponse<T> = { success: boolean; data: T | null; error: ApiError | null };
```

`response.ok` 와 `result.success` 를 함께 확인한다. HTTP 200 이어도 `success: false` 일 수 있다.

## 구조

기능 단위 폴더(`src/features/<기능>/`)로 나누고, 폴더 안을 **타입 / API / 훅 / 화면**
네 갈래로 쪼갠다. 새 기능도 이 배치를 따른다.

```
src/features/dashboard/
├─ dashboardOverviewTypes.ts   백엔드 응답 타입
├─ DashboardOverviewApi.ts     fetch + 봉투 해제
├─ useDashboardOverview.ts     조회 + SSE 구독
└─ DashboardPage.tsx           화면

src/features/chatbot/
├─ chatbotTypes.ts
├─ chatbotApi.ts
├─ useChatSession.ts
├─ ChatbotPage.tsx
└─ components/                 화면이 커서 조각을 분리한 경우만 둔다
```

라우트는 [src/App.tsx](src/App.tsx) 한 곳에 모은다.

## 규칙

**스타일.** 대시보드는 파일 하단에 `const xxxStyle = {...}` 객체를 모아두는 인라인
스타일이고, 챗봇은 디자인 시스템 토큰(`src/styles/tokens/`)을 `var(--color-*)` 로 참조하는
인라인 스타일이다. CSS-in-JS 라이브러리나 CSS Modules 를 새로 들이지 않는다.
`src/styles/tokens/` 의 값은 **디자인 시스템 원본이라 수정하지 않는다.**

**챗봇 문구.** 고객에게 보이는 말풍선 문구는 전부 백엔드가 생성해 내려준다
(`backend/docs/customer-chatbot/messages.md` 가 B.1~B.6 으로 관리한다).
**프론트에 챗봇 대사를 하드코딩하지 않는다.** 새 문구가 필요하면 그 문서에 먼저 추가한다.

**SSE.** `EventSource` 를 훅의 `useEffect` 안에서 열고 cleanup 에서 반드시 `close()` 한다.
StrictMode 이중 실행에 대비해 `isActive` 플래그로 언마운트 후 setState 를 막는다
([useDashboardOverview.ts](src/features/dashboard/useDashboardOverview.ts) 가 기준 구현이다).

**주석.** 파일 상단에 그 파일이 무엇을 하는지 한국어 한두 줄을 남기는 것이 이 레포의 관행이다.

## 참고 문서

- [README.md](README.md) — 실행 방법
- [docs/customer-chatbot-frontend.md](docs/customer-chatbot-frontend.md) — 챗봇 화면 작업 문서
  (범위·상태 기계·디자인 반영 판단)
- [docs/chatbot-e2e-test.md](docs/chatbot-e2e-test.md) — 챗봇 화면을 로컬에서 돌려보는 절차.
  세션 생성 API 가 없어 DB 시드 + 스크립트가 유일한 경로다
- `../backend/docs/customer-chatbot/` — 챗봇 요구사항 원본. `README.md`(흐름),
  `messages.md`(고객 문구), `schema.md`(테이블). 챗봇 동작을 바꾸기 전에 여기를 먼저 본다.
