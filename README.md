# FDS Dashboard Frontend

FDS(이상거래 탐지) 통합 모니터링 대시보드의 프론트엔드입니다.
React 19 + TypeScript + Vite 기반이며, 백엔드 API를 조회하고 SSE로 실시간 갱신합니다.

## 요구 사항

- **Node.js** `^20.19.0` 또는 `>=22.12.0` (Vite 7 요구 버전)
- **npm** 10 이상
- 백엔드 API 서버가 `http://localhost:8010` 에서 실행 중이어야 합니다.

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

| 프론트 요청 경로 | 프록시 대상 |
| --- | --- |
| `/api/*` | `http://localhost:8010/api/*` |

사용 중인 엔드포인트는 다음과 같습니다.

- `GET /api/dashboard/overview?period_start=...&period_end=...` — 대시보드 집계 조회
- `GET /api/dashboard/events` — SSE 연결. `dashboard_updated` 이벤트 수신 시 overview를 재조회합니다(500ms 디바운스).

> 백엔드 포트가 다르면 [vite.config.ts](vite.config.ts)의 `server.proxy['/api'].target` 값을 바꿔주세요.
> 백엔드가 떠 있지 않으면 화면에 `오류: 대시보드 조회에 실패함` 메시지가 표시됩니다.

조회 기간은 현재 [DashboardPage.tsx](src/features/dashboard/DashboardPage.tsx)의 `TEST_PERIOD` 상수에 하드코딩되어 있습니다.

## 빌드 및 프리뷰

```bash
# 타입 체크 후 정적 파일 빌드 (결과물: dist/)
npm run build

# 빌드 결과물을 로컬에서 확인
npm run preview   # http://localhost:4173
```

> `npm run preview`에는 개발 서버의 `/api` 프록시가 적용되지 않습니다.
> 빌드 결과물을 실제로 확인하려면 배포 환경(Nginx 등)에서 `/api` 요청을 백엔드로 라우팅하도록 설정해야 합니다.

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
| `오류: 대시보드 조회에 실패함` | 백엔드가 8010 포트에서 실행 중인지, 프록시 target이 맞는지 확인 |
| 실시간 갱신이 안 됨 | 브라우저 개발자도구 Network 탭에서 `/api/dashboard/events` SSE 연결 상태 확인 |
| 5173 포트 사용 중 | 기존 프로세스를 종료하거나 `npm run dev -- --port 5174` 로 실행 |
| 설치/빌드 오류 | Node 버전이 요구 사항을 만족하는지 확인 후 `rm -rf node_modules && npm install` |
