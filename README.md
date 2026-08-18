# FDS Dashboard Frontend

FDS(이상거래 탐지) 통합 모니터링 대시보드의 프론트엔드입니다.
React 19 + TypeScript + Vite 기반이며, 백엔드 API를 조회하고 SSE로 실시간 갱신합니다.

## 요구 사항

- **Node.js** `^20.19.0` 또는 `>=22.12.0` (Vite 7 요구 버전)
- **npm** 10 이상
- 백엔드 API 서버가 `http://localhost:8000` 에서 실행 중이어야 합니다.

```bash
node -v
npm -v
```

## 설치

```bash
git clone <레포지토리 주소>
cd frontend
npm install
```

## 실행 (개발 모드)

```bash
npm run dev
```

- 개발 서버: http://localhost:5173
- `--host 0.0.0.0` 옵션이 걸려 있어 같은 네트워크의 다른 기기에서도 `http://<내 IP>:5173` 으로 접속할 수 있습니다.
- 소스를 저장하면 HMR로 화면이 자동 갱신됩니다.

## 백엔드 연동

프론트엔드는 백엔드 주소를 직접 호출하지 않고, Vite 개발 서버의 프록시를 통해 요청합니다.
([vite.config.ts](vite.config.ts))

| 프론트 요청 경로 | 프록시 대상 | 비고 |
| --- | --- | --- |
| `/api/dashboard/*` | `http://localhost:8000/api/dashboard/*` | 경로 그대로 |
| `/api/chat/*` | `http://localhost:8000/chat/*` | `/api` 를 떼고 전달 |
| `/api/agent/*` | `http://localhost:8000/agent/*` | `/api` 를 떼고 전달 |
| `/api/rule-*` | `http://localhost:8000/rule-*` | 룰 관리 API로 전달 |
| `/api/mlops/*` | `http://localhost:8000/mlops/*` | 모델 관리 API로 전달 |

챗봇 API만 `/api` 접두어를 붙여 부르는 이유는, 고객이 브라우저로 여는 챗봇 화면 주소가
`/chat/{chat_session_id}` 라서 `/chat` 을 그대로 프록시하면 화면 대신 API 응답이 내려오기 때문입니다.

사용 중인 엔드포인트는 다음과 같습니다.

- `GET /api/dashboard/overview?period_start=...&period_end=...` — 대시보드 집계 조회
- `GET /api/dashboard/events` — SSE 연결. `dashboard_updated` 이벤트 수신 시 overview를 재조회합니다(500ms 디바운스).
- `POST /api/chat/{id}/verify` · `GET /api/chat/{id}` · `POST /api/chat/{id}/actions` · `POST /api/chat/{id}/messages` — 고객 챗봇 화면

> 백엔드 포트가 다르면 [vite.config.ts](vite.config.ts)의 `BACKEND_TARGET` 값을 바꿔주세요.
> 백엔드가 떠 있지 않으면 화면에 `오류: 대시보드 조회에 실패함` 메시지가 표시됩니다.

조회 기간은 현재 [DashboardPage.tsx](src/features/dashboard/DashboardPage.tsx)의 `TEST_PERIOD` 상수에 하드코딩되어 있습니다.

## 화면

| 경로 | 화면 |
| --- | --- |
| `/` | FDS 통합 모니터링 대시보드 |
| `/#rules` | 룰 규칙 관리 |
| `/#model` | 데이터셋·학습·모델 관리 |
| `/chat/:chatSessionId` | 고객 대응 챗봇 ([작업 문서](docs/customer-chatbot-frontend.md)) |

룰·모델 관리 화면은 Backend의 `X-MLOps-Admin-Token`을 요구합니다. 로컬 개발
서버는 `../backend/.env`의 토큰을 브라우저에 노출하지 않고 관리자 API 요청에
자동으로 전달합니다. 운영에서는 화면에서 입력한 토큰을 현재 브라우저 탭의
`sessionStorage`에만 보관합니다.

챗봇 화면은 백엔드가 이메일로 보낸 세션 URL로 접속합니다. 백엔드 `.env` 의 `CHAT_BASE_URL` 을
이 프론트 주소(`http://localhost:5173`)로 맞춰야 메일 링크가 이 화면으로 옵니다.

로컬에서 챗봇 화면을 직접 돌려보는 절차(DB 준비 → 테스트 데이터 → 세션 생성 → 화면 확인)는
**[docs/chatbot-e2e-test.md](docs/chatbot-e2e-test.md)** 에 있습니다.

## 빌드 및 프리뷰

```bash
# 타입 체크 후 정적 파일 빌드 (결과물: dist/)
npm run build

# 빌드 결과물을 로컬에서 확인
npm run preview   # http://localhost:4173
```

> `npm run preview`에는 개발 서버의 `/api` 프록시가 적용되지 않습니다.
> 빌드 결과물을 실제로 확인하려면 배포 환경(Nginx 등)에서 `/api` 요청을 백엔드로 라우팅하도록 설정해야 합니다.

## 배포

- 운영 주소: https://fdshield.cloud
- `dev` 브랜치에 반영되면 GitHub Actions가 `npm ci`와 `npm run build`를 실행합니다.
- 성공한 `dist/`는 기존 VM의 `/opt/fdshield/frontend/releases/<commit>`에 업로드됩니다.
- `current` 링크를 새 릴리스로 교체한 뒤 공용 Nginx를 reload하므로 별도 Frontend 컨테이너는 사용하지 않습니다.
- 브라우저의 상대경로 요청은 Nginx가 Backend 컨테이너로 전달하므로 배포용 API 환경변수는 없습니다.

자동 배포에는 저장소의 `VM_HOST`, `VM_USER`, `VM_SSH_PORT`,
`VM_SSH_PRIVATE_KEY`, `VM_SSH_KNOWN_HOSTS` Secret을 사용합니다.

## npm 스크립트

| 스크립트 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 (0.0.0.0:5173) |
| `npm run build` | `tsc -b` 타입 체크 후 프로덕션 빌드 |
| `npm run preview` | 빌드 결과물 정적 서빙 (0.0.0.0:4173) |

## 디렉터리 구조

```
.
├── index.html                  # Vite 진입 HTML
├── vite.config.ts              # 개발 서버 및 /api 프록시 설정
├── tsconfig.json
└── src
    ├── main.tsx                # React 렌더링 진입점
    └── features/dashboard
        ├── DashboardPage.tsx           # 대시보드 화면
        ├── useDashboardOverview.ts     # 조회 + SSE 실시간 갱신 훅
        ├── DashboardOverviewApi.ts     # overview API 호출
        └── dashboardOverviewTypes.ts   # API 응답 타입
```

## 문제 해결

| 증상 | 확인할 것 |
| --- | --- |
| `오류: 대시보드 조회에 실패함` | 백엔드가 8000 포트에서 실행 중인지, 프록시 target이 맞는지 확인 |
| 챗봇 API가 전부 500 | 백엔드 DB에 챗봇 테이블이 없는 경우입니다. 백엔드 레포에서 `alembic upgrade head` 실행 |
| 실시간 갱신이 안 됨 | 브라우저 개발자도구 Network 탭에서 `/api/dashboard/events` SSE 연결 상태 확인 |
| 5173 포트 사용 중 | 기존 프로세스를 종료하거나 `npm run dev -- --port 5174` 로 실행 |
| 설치/빌드 오류 | Node 버전이 요구 사항을 만족하는지 확인 후 `rm -rf node_modules && npm install` |
