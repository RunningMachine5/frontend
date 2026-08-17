# 고객 대응 챗봇 프론트엔드 — 작업 문서

백엔드 PRD [docs/customer-chatbot/README.md](../../backend/docs/customer-chatbot/README.md)의
2.2~2.6을 고객이 실제로 쓰는 화면으로 옮기는 작업이다. 화면은 Claude Design 핸드오프 번들
`챗봇아이콘_디자인8:17`의 `Chat.dc.html`을 React로 그대로 재현한다.

| 항목 | 값 |
| --- | --- |
| 요구사항 | `backend/docs/customer-chatbot/` (README·messages·schema) |
| 디자인 원본 | `~/Downloads/챗봇아이콘_디자인8:17/project/Chat.dc.html` + `_ds/` 토큰 |
| 백엔드 API | `backend/app/api/chat.py`, 계약은 `backend/app/dto/chatbot.py` |
| 라우트 | `/chat/:chatSessionId` |

---

## 1. 범위

### 1.1 이번 작업에 넣는 것

PRD 2.2~2.6의 **고객 화면 전체 흐름**이다.

| PRD | 화면 동작 |
| --- | --- |
| 2.2 채팅 접속 및 본인인증 | 출생연도 4자리 입력 게이트 → 인증 성공 전환 화면 → 챗봇 화면 |
| 2.3 최초 알림 메시지와 버튼 | 최초 알림 말풍선 + 버튼 3종, 이때 입력창 비활성화 |
| 2.4 정보 수집 | 고객 답변 전송, 재질문·다음 질문 안내를 챗봇 말풍선으로 출력 |
| 2.5 RAG 대응 가이드 | 턴 응답으로 내려온 안내 본문을 그대로 말풍선에 출력 |
| 2.6 사기 정황 채점 | 화면 표시 없음 — 백엔드 내부 집계다 |

### 1.2 이번 작업에서 빼는 것

- **PRD 2.7 담당자 반환 경로(거래별 세션 상태 + `/agent` SSE).** 담당자 화면은 거래 목록에
  붙는 기능인데 이 레포에는 아직 거래 목록 화면이 없다([DashboardPage.tsx](../src/features/dashboard/DashboardPage.tsx)는
  집계 카드와 막대그래프뿐이다). 붙일 곳이 생긴 뒤에 별도 작업으로 한다.
- **고령자 전용 UI.** PRD 2.2가 "추후 구현"으로 남긴 항목이다. 응답의 `is_older`는
  훅까지 전달만 해두고 분기는 두지 않는다.
- **디자인 원본의 퀵리플라이 스크립트.** 아래 3.2에서 설명한다.

---

## 2. 백엔드 계약

`backend/app/api/chat.py`의 고객 경로 4개만 쓴다. 응답은 전부 공통 봉투
`ApiResponse<T>`(`success`/`data`/`error`)이며, 대시보드가 이미 쓰는 것과 같은 형태다.

| 호출 시점 | 메서드 · 경로 | 응답 |
| --- | --- | --- |
| 첫 진입(인증) | `POST /chat/{id}/verify` | `ChatSessionDetailResponse` — 상태 + **전체 이력** |
| 새로고침·재접속 | `GET /chat/{id}` | `ChatSessionDetailResponse` |
| 버튼 3종 | `POST /chat/{id}/actions` | `ChatTurnResponse` — **이번 턴 메시지만** |
| 고객 답변 | `POST /chat/{id}/messages` | `ChatTurnResponse` |

두 응답 형태의 차이가 화면 로직을 가른다.

- `ChatSessionDetailResponse.messages`는 `ChatMessageResponse[]`(누적 이력)라 **덮어쓴다.**
- `ChatTurnResponse.messages`는 `string[]`(그 턴의 챗봇 발화)라 **뒤에 덧붙인다.**
- 고객이 방금 보낸 말은 턴 응답에 들어오지 않는다. 화면이 낙관적으로 먼저 붙인다.

오류 처리:

| 상태 | 상황 | 화면 |
| --- | --- | --- |
| 401 | 출생연도 불일치 | 게이트에 「출생연도가 일치하지 않습니다」 표시, 재시도 |
| 404 | 없는 세션 id | 게이트 대신 오류 화면 |
| 409 | 현재 상태에서 받을 수 없는 입력 | `GET /chat/{id}`로 상태를 다시 맞춘다 |
| 422 | 4자리가 아님 | 클라이언트에서 먼저 막는다(입력 필터 + 버튼 비활성화) |

### 2.1 프록시 경로를 `/api/chat`으로 바꾼다 — 중요

백엔드 라우터 prefix는 `/chat`, `/agent`이고 대시보드만 `/api/dashboard`다.
그런데 **고객이 브라우저로 여는 챗봇 화면 주소도 `/chat/{id}`다.** 개발 서버에서 `/chat`을
그대로 백엔드로 프록시하면 화면이 열리지 않고 API JSON이 내려온다.

그래서 프론트는 `/api/chat/...`으로 호출하고, Vite 프록시가 `/api`를 떼어 백엔드
`/chat/...`으로 넘긴다. 브라우저 경로 `/chat/{id}`는 프록시 규칙에 걸리지 않으므로
그대로 SPA로 열린다.

```ts
// vite.config.ts — 더 좁은 규칙을 먼저 둔다(Vite는 키 순서대로 매칭한다)
proxy: {
  "/api/chat":  { target, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, "") },
  "/api/agent": { target, changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, "") },
  "/api":       { target, changeOrigin: true },   // 대시보드는 백엔드도 /api/dashboard 다
}
```

기존 대시보드 규칙(`/api` 무재작성)은 건드리지 않는다.

### 2.2 백엔드 `CHAT_BASE_URL`을 프론트 주소로 둬야 한다

세션 URL을 메일에 넣는 쪽은 백엔드이고 기본값이 `http://localhost:8000`(백엔드 자신)이다.
챗봇 UI를 이 레포가 서빙하므로 백엔드 `.env`에서 프론트 주소로 바꿔야 고객이 받은 링크가
이 화면으로 온다. PRD 2.1이 같은 내용을 적어두었다.

```
CHAT_BASE_URL=http://localhost:5173
```

프론트 코드 변경은 아니지만 이 값이 틀리면 화면이 아예 열리지 않으므로 여기 남긴다.

---

## 3. 디자인 반영

### 3.1 가져오는 것

핸드오프 번들은 프로토타입이라 내부 구조가 아니라 **시각 결과**를 옮긴다.
`Chat.dc.html`의 인라인 스타일 값(치수·색·라운드·애니메이션)을 그대로 쓴다.

| 원본 | 옮길 위치 |
| --- | --- |
| `_ds/tokens/{colors,fonts,effects,spacing}.css` | `src/styles/tokens/` — 값 수정 없이 복사 |
| `assets/fonts/KBFGText-{Light,Medium}.otf` | `public/fonts/` — `@font-face` url만 `/fonts/`로 수정 |
| `uploads/financial-chatbot-hamster-70.png` | `src/assets/chatbot/` — 디자인이 쓰는 캐릭터(햄주임) |
| `@keyframes typingDot` / `shieldPop` | `src/styles/chatbot.css` |

번들의 다른 캐릭터 5종(fox·bear·cat·dog·rabbit)은 `Chat.dc.html`이 참조하지 않으므로
복사하지 않는다.

화면 골격도 원본 그대로다 — 390×844 카드, `border-radius:32px`,
`box-shadow:0 24px 64px rgba(40,47,50,.18)`, 헤더 / 스크롤 영역 / 입력줄 3단 세로 배치.
말풍선 라운드도 좌우가 다르다(챗봇 `4px 16px 16px 16px`, 고객 `16px 4px 16px 16px`).

### 3.2 버리는 것 — 프로토타입의 목 스크립트

`Chat.dc.html`의 `SCRIPT` / `REPLIES` 상수(스미싱 시나리오, 「이미 링크를 눌렀어요」 같은
퀵리플라이 칩)는 디자인 시연용 목이다. **백엔드에 대응하는 개념이 없다.**
PRD의 대화는 챗봇이 질문하고 고객이 자유 서술로 답하는 단일 경로이며, 선택지를 내려주는
API가 없다. 퀵리플라이 **UI 컴포넌트 자체는 남기지 않는다** — 채울 데이터가 없는 컴포넌트를
두면 다음 사람이 백엔드에 없는 기능을 찾게 된다.

같은 이유로 `postVerify` / `postAction`의 `setTimeout` 목은 실제 fetch로 대체한다.
프로토타입이 목에 넣어둔 상태 전이(`URL_SENT` → `SUBMITTING` → …)는 실제 계약과 일치하므로
그대로 따른다. 특히 **`SUBMITTING`은 클라이언트 전용 상태**로 유지한다 — 버튼을 즉시
언마운트해 더블클릭으로 409가 나는 것을 막는 장치이고, 원본 주석이 같은 의도를 적어두었다.

### 3.3 문구는 백엔드가 정한다

`messages.md`가 "코드에 문구를 새로 쓰지 않는다"고 못박았고, B.1~B.6은 전부 백엔드가
생성해 `messages`로 내려준다. **프론트는 말풍선 텍스트를 하드코딩하지 않는다.**
디자인 원본의 「안내 문자를 확인하셨네요…」는 목이므로 백엔드 최초 알림(B.1)으로 대체한다.

버튼 라벨만 예외다. 원본은 「대화 시작하기 / 상담원 연결 요청 / 대화 종료」인데
PRD 2.3은 「챗봇 상담 / 상담사 연결 / 종료」로 부른다. 라벨을 내려주는 API가 없어
어느 쪽이든 프론트 상수가 되므로 **PRD 표기를 쓴다.** 문구 권한이 PRD에 있고,
`END_CHAT` 안내(B.2)가 "상담을 종료합니다"라 「대화 종료」와 어긋나기 때문이다.
디자인 쪽 라벨을 살리려면 `messages.md`에 먼저 추가하는 것이 문서 규칙이다.

---

## 4. 화면 상태 기계

세션 `status` 5종에 인증 여부와 클라이언트 전용 `SUBMITTING`을 겹친 것이 화면 상태다.

```
[게이트] --verify 200--> [인증 완료 전환 1.4s] --> [채팅]
   ^                                                 |
   +--401--+                                          |
                                                     v
            URL_SENT ──버튼──> SUBMITTING ──> IN_PROGRESS ──WANT_END──> HANDOFF_REQUESTED
                                    ├──────────────────────────────────> HANDOFF_REQUESTED
                                    └──────────────────────────────────> DONE
```

입력창은 **`IN_PROGRESS`일 때만 활성화**한다(PRD 2.3이 버튼 선택 전 비활성화를 명시).
플레이스홀더는 상태별로 바뀌며 원본 `placeholders` 맵을 그대로 쓴다.

| `status` | 버튼 카드 | 입력창 | 플레이스홀더 |
| --- | --- | --- | --- |
| `URL_SENT` | 표시 | 비활성 | 위에서 옵션을 선택해 주세요 |
| `SUBMITTING`(클라이언트) | 숨김 | 비활성 | 처리 중입니다… |
| `IN_PROGRESS` | 숨김 | 활성 | 메시지를 입력하세요 |
| `HANDOFF_REQUESTED` | 숨김 | 비활성 | 상담원 연결 대기 중입니다 |
| `DONE` | 숨김 | 비활성 | 상담이 종료되었습니다 |
| `FAILED` | 숨김 | 비활성 | 상담이 종료되었습니다 |

`FAILED`는 메일 발송 실패로 남은 세션이라 고객이 이 화면에 닿는 경우가 거의 없지만,
`ChatSessionStatusValue`의 5번째 값이므로 입력을 막는 쪽으로 처리한다.

### 4.1 답변 전송 한 턴

`POST /chat/{id}/messages`는 평가·분해·검색·생성 LLM을 거치므로 응답이 느리다.
원본의 타이핑 인디케이터를 **실제 대기 표시**로 쓴다.

1. 입력값을 고객 말풍선으로 즉시 추가하고 입력창을 비운다(낙관적).
2. 타이핑 인디케이터를 켜고 입력을 잠근다.
3. 응답의 `messages`를 순서대로 챗봇 말풍선에 붙이고, `status`·`question_step`을 갱신한다.
4. 실패하면 인디케이터를 끄고 오류 배너를 띄운다. **고객 말풍선은 지우지 않는다** —
   백엔드가 이미 저장했을 수 있고, 지우면 고객이 같은 말을 두 번 하게 된다.
   복구는 `GET /chat/{id}` 재조회다.

메시지가 늘어날 때마다 스크롤을 맨 아래로 내린다(원본 `scrollToBottom`).

---

## 5. 파일 계획

기존 `src/features/dashboard/`와 같은 기능 폴더 규칙을 따른다.
API 호출 / 타입 / 훅 / 화면을 파일로 나누는 배치도 그대로다.

```
src/
├─ main.tsx                       (수정) BrowserRouter 로 App 을 감싼다
├─ App.tsx                        (신규) /chat/:chatSessionId → ChatbotPage, / → DashboardPage
├─ styles/
│  ├─ tokens/{colors,fonts,effects,spacing}.css   (복사)
│  └─ chatbot.css                 (신규) typingDot·shieldPop 키프레임
├─ assets/chatbot/financial-chatbot-hamster-70.png (복사)
└─ features/chatbot/
   ├─ chatbotTypes.ts             app/dto/chatbot.py 대응 타입
   ├─ chatbotApi.ts               verify / get / actions / messages + ApiResponse 언랩
   ├─ useChatSession.ts           상태·이력·턴 실행·오류를 쥔 훅
   ├─ ChatbotPage.tsx             라우트 진입점, 게이트/전환/채팅 전환
   └─ components/
      ├─ IdentityGate.tsx         출생연도 4자리 입력
      ├─ VerifiedTransition.tsx   방패 SVG 1.4초 전환 화면
      ├─ ChatHeader.tsx           캐릭터·이름·상태 점
      ├─ MessageList.tsx          말풍선 목록 + 타이핑 인디케이터 + 버튼 카드
      └─ ChatComposer.tsx         입력창 + 전송 버튼
```

`public/fonts/`에 otf 2개를 둔다.

토큰 CSS는 `main.tsx`에서 한 번 import한다. 대시보드는 인라인 스타일만 쓰므로 토큰이
들어와도 영향이 없고, 챗봇 화면만 `var(--color-*)`를 참조한다.

의존성은 **`react-router-dom` 하나만 추가**한다. 라우트가 둘뿐이라 직접 파싱해도 되지만,
챗봇은 URL의 세션 id로만 진입하는 화면이라 경로 파라미터를 다루는 코드가 어차피 필요하다.

---

## 6. 작업 순서

1. `react-router-dom` 설치, `vite.config.ts` 프록시에 `/api/chat`·`/api/agent` 재작성 규칙 추가
2. 디자인 토큰 CSS·폰트·캐릭터 이미지 복사, `chatbot.css` 작성
3. `chatbotTypes.ts` — `app/dto/chatbot.py`의 응답 4종을 타입으로 옮김
4. `chatbotApi.ts` — `ApiResponse` 언랩과 상태코드별 오류를 한 곳에서 처리
5. `useChatSession.ts` — 4.1의 턴 흐름과 상태 전이
6. 컴포넌트 5종 → `ChatbotPage.tsx` 조립
7. `App.tsx` 라우팅, `main.tsx` 연결
8. `npm run build`로 타입 체크, 백엔드를 띄우고 `scripts/create_chat_session.py`로 세션을
   만들어 실제 흐름 확인

---

## 7. 검증 결과

`npm run build`(`tsc -b` 포함) 통과. 개발 서버에서 HTTP 수준까지 확인한 것은 아래와 같다.

| 확인 | 결과 |
| --- | --- |
| `GET /chat/{id}` 가 SPA 로 열리는지 | 200, `index.html` — API 응답이 아니다 |
| `/api/chat/{id}` 재작성 | 백엔드 `/chat/{id}` 와 응답이 동일 |
| 재작성이 실제로 필요한지 | 백엔드에 `/api/chat/{id}` 로 직접 요청하면 404 |
| `/api/dashboard/*` | 재작성 없이 그대로 전달(기존 동작 유지) |
| `/fonts/KBFGText-Medium.otf` | 200 |

실제 세션으로 고객 흐름 전체(본인인증 → 버튼 → 답변 2턴 → 종료 → 상담사 연결)도
프론트 개발 서버를 거쳐 확인했다. 절차와 결과는
**[chatbot-e2e-test.md](chatbot-e2e-test.md)** 에 따로 정리했다.

화면 렌더링 결과 자체는 브라우저로 봐야 하며, 여기서 확인한 것은 화면이 호출하는
API 계약과 프록시까지다.

---

## 8. 확인이 필요한 것

- **버튼 라벨(3.3).** PRD 표기로 구현했다. 디자인 원본 라벨을 쓰려면 `messages.md`에
  먼저 추가해야 한다.
- **고령자 UI(1.2).** `is_older`가 참인 세션도 지금은 기본 UI로 간다. PRD가 "추후 구현"으로
  남긴 항목이라 별도 디자인이 나와야 붙일 수 있다.
- **로컬 확인에는 백엔드 세션이 필요하다.** 세션 생성 API가 없으므로(PRD 2.1)
  백엔드 레포에서 `uv run --env-file .env python -m scripts.create_chat_session <transaction_id>`로
  세션 id를 뽑아 `/chat/{id}`로 연다.
