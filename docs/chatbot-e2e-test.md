# 챗봇 화면 로컬 테스트 가이드

`/chat/{chat_session_id}` 화면을 실제 백엔드에 붙여 끝까지 돌려보는 절차다.
아래 명령은 전부 실제로 실행해 확인했고, 확인 결과는 [7장](#7-검증-결과)에 있다.

세션 생성 API 가 없어서(PRD 2.1) **DB 에 고객·거래를 넣고 스크립트로 세션을 만드는 것**이
이 화면을 여는 유일한 로컬 경로다.

| 준비물 | 확인 방법 |
| --- | --- |
| Docker (ParadeDB) | `docker compose ps` |
| 백엔드 레포 `../backend` + `.env` | `OPENAI_API_KEY` 가 들어 있어야 한다 |
| 프론트 `npm install` 완료 | — |

ML Serving(`:8001`)은 **필요 없다.** 거래를 DB 에 직접 넣기 때문에 `POST /transactions`
경로를 타지 않는다.

---

## 1. DB 준비

백엔드 레포에서 실행한다.

```bash
cd ../backend
docker compose up -d
uv run --env-file .env alembic upgrade head
uv run --env-file .env alembic current   # b4167d7782e1 (head)
```

`Can't locate revision identified by ...` 가 나오면 마이그레이션이 init 하나로 합쳐지기
전의 DB 다. 볼륨까지 지우고 다시 만든다 — 자세한 내용은 백엔드의
`docs/db-migration-reset.md` 에 있다.

```bash
docker compose down -v && docker compose up -d
uv run --env-file .env alembic upgrade head
```

챗봇 테이블이 생겼는지 확인한다. 이 다섯 개가 없으면 챗봇 API 가 전부 500 이 난다.

```bash
docker compose exec -T db psql -U root -d fdshield-db -c "\dt" | grep chat_
# chat_answers / chat_fraud_circumstances / chat_guide_search_queries
# chat_messages / chat_sessions
```

## 2. 백엔드 `.env` 에 챗봇 설정 추가

`.env` 에 아래 두 줄이 없으면 기본값이 쓰이는데, **둘 다 로컬 테스트에는 맞지 않는다.**

```bash
# 세션 URL 의 호스트. 기본값이 백엔드 자신(:8000)이라 그대로 두면 챗봇 화면이 아니라 API 로 간다.
CHAT_BASE_URL=http://localhost:5173

# LLM 호출당 타임아웃(초). 기본값 5 는 너무 짧다 — 아래 설명 참고.
CHAT_LLM_TIMEOUT_SECONDS=120
```

`CHAT_LLM_TIMEOUT_SECONDS` 가 왜 중요한지: 챗봇은 한 턴에 LLM 을 여러 번 부르고
(응답 평가 → 가이드 검색 질의 분해 → 사기 정황 추출 → 가이드 생성),
기본 모델이 `gpt-5` 라 호출 하나가 수십 초 걸린다. 기본값 5초로는 **평가만 성공하고
나머지가 전부 타임아웃**한다. 화면상으로는 대응 가이드 없이 다음 질문만 나와서
정상처럼 보이므로 알아채기 어렵다. 실측치는 아래와 같다.

| `CHAT_LLM_TIMEOUT_SECONDS` | 결과 |
| --- | --- |
| 5 (기본값) | 분해 LLM 타임아웃 → 가이드 안내 없음, 턴 24초 |
| 30 | 여전히 타임아웃 → 가이드 안내 없음, 턴 76초 |
| 120 | 정상 — 검색 질의 3개 분해, 가이드 안내 출력, 턴 73초 |

타임아웃이 나도 턴은 실패하지 않는다(PRD 2.5의 설계다). 그래서 **로그를 봐야 구분된다.**

```
가이드 검색 질의 분해 LLM 호출 실패: attempts=2 error=APITimeoutError
```

더 빠르게 돌리고 싶으면 `OPENAI_MODEL` 로 가벼운 모델을 지정하는 방법도 있다.

## 3. 백엔드 실행

```bash
cd ../backend
uv run --env-file .env uvicorn main:app --reload --host 0.0.0.0 --port 8000
curl -s localhost:8000/health   # {"status":"ok"}
```

## 4. 테스트용 고객·거래 넣기

`transactions` 가 비어 있으면 세션을 만들 수 없고, 본인인증이 `customers.birth_date` 의
연도와 대조하므로 **거래에 고객이 연결돼 있어야 한다.** 계좌번호는 `accounts` 를 참조하는
FK 가 걸려 있어 계좌도 함께 넣는다.

```bash
cd ../backend
docker compose exec -T db psql -U root -d fdshield-db <<'SQL'
INSERT INTO customers (
    id, name, birth_date, gender, identification_number,
    phone_number, email, registration_datetime,
    credit_rating, loan_type, created_at, updated_at
) VALUES (
    'CUST-CHAT-TEST', '홍길동', DATE '1958-03-11', 'male', 'ID-CHAT-TEST-0001',
    '010-0000-0000', NULL, now(), 3, 'a', now(), now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO accounts (
    id, customer_id, account_number, account_type, creation_datetime,
    suspend_status, created_at, updated_at
) VALUES
    ('ACCT-CHAT-TEST-SRC', 'CUST-CHAT-TEST', '123456789400', 'a', now(), false, now(), now()),
    ('ACCT-CHAT-TEST-DST', NULL,             '987654321400', 'a', now(), false, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO transactions (
    customer_id, source_account_number, recipient_account_number,
    transaction_datetime, transaction_amount, channel,
    type_general_automatic, access_medium, num_connection_failure,
    another_person_account, location,
    rooting_jailbreak_indicator, mobile_roaming_indicator, vpn_indicator,
    flag_terminal_malicious_behavior_1, flag_terminal_malicious_behavior_2,
    flag_terminal_malicious_behavior_3, flag_terminal_malicious_behavior_5,
    flag_terminal_malicious_behavior_6, created_at
) VALUES (
    'CUST-CHAT-TEST', '123456789400', '987654321400',
    TIMESTAMPTZ '2026-08-15 14:03:00+09', -1234000, 'mobile',
    'general', 'a', 0, true, 'Seoul',
    false, false, false, false, false, false, false, false, now()
) RETURNING id;
SQL
```

마지막에 나온 `id` 가 다음 단계에서 쓸 `transaction_id` 다.

이 데이터가 화면에 어떻게 나타나는지:

| 넣은 값 | 화면 |
| --- | --- |
| `birth_date` 연도 `1958` | 본인인증에 입력할 4자리 |
| 1958년생 = 60세 이상 | `is_older = true` (고령자 UI 는 미구현이라 기본 UI) |
| `transaction_amount = -1234000` | 최초 알림에 `1,234,000원 출금` (음수 = 출금) |

## 5. 채팅 세션 만들기

```bash
cd ../backend
uv run --env-file .env python -m scripts.create_chat_session <transaction_id> \
    --top-fraud-types VOICE_PHISHING MESSENGER_PHISHING
```

```
세션 id   : CHAT-20260817-0D3EFDF5
상태      : URL_SENT
수신 예정 주소: abcd@kosa.com (기본 주소 폴백)
접속 URL  : http://localhost:5173/chat/CHAT-20260817-0D3EFDF5
```

- `--top-fraud-types` 는 1단계 **유형판별 질문**을 고르는 값이다. 생략하면 일반 질문
  폴백으로 간다. 가능한 값은 `VOICE_PHISHING` `MESSENGER_PHISHING`
  `ACCOUNT_TAKEOVER` `FRAUD_USED_ACCOUNT` 중 서로 다른 둘이다.
- 생성은 **멱등**이라 같은 거래로 다시 돌리면 기존 URL 이 나온다.
  대화를 처음부터 다시 하려면 `--recreate` 를 붙인다(기존 이력이 지워진다).
- `수신 예정 주소`가 `abcd@kosa.com (기본 주소 폴백)`인 것은 정상이다.
  테스트 고객의 `email` 이 `NULL` 이라 폴백 주소를 쓴 것이고, 스크립트는 메일을 보내지 않는다.

## 6. 프론트에서 열기

```bash
cd ../frontend
npm run dev
```

5번에서 나온 **접속 URL 을 브라우저에 그대로 붙여넣는다.**

화면 순서:

1. **본인인증** — `1958` 입력 → 확인
   (틀린 연도면 「본인인증에 실패했습니다.」가 입력창 아래에 뜨고 재시도할 수 있다)
2. **전환 화면** — 방패 애니메이션 1.4초
3. **최초 알림 + 버튼 3종** — 이때 입력창은 비활성이고
   플레이스홀더가 「위에서 옵션을 선택해 주세요」다
4. **챗봇 상담** 클릭 → 유형판별 질문 출력, 입력창 활성화
5. 답변 입력 → 타이핑 표시가 뜬 채로 **1분 이상 기다린다**(LLM 4종 호출)
   → 대응 가이드 + 다음 질문
6. `종료할게요` 입력 → 상담사 연결 안내, 입력창이 다시 잠긴다

시나리오 답변 예시(사기 정황이 들어 있는 문장):

```
검찰이라고 전화가 와서 제 계좌가 범죄에 연루됐다고 했어요. 안전계좌로 옮기라고 해서 1234000원을 보냈습니다.
문자로 받은 링크를 눌러서 앱을 하나 설치했고, 신분증 사진도 찍어서 보냈어요.
종료할게요
```

DB 에 쌓인 결과 확인:

```bash
docker compose exec -T db psql -U root -d fdshield-db \
  -c "select question_step, attempt_no, quality_verdict, is_adopted from chat_answers;" \
  -c "select position, title from chat_guide_search_queries order by position;" \
  -c "select circumstance_code from chat_fraud_circumstances;" \
  -c "select type_scores from fraud_type_score_after_chat;"
```

담당자 경로(PRD 2.7)는 화면이 아직 없어 API 로만 확인한다.

```bash
curl -s localhost:5173/api/agent/transactions/<transaction_id>/chat-session
# {"success":true,"data":{"transaction_id":2,"chat_session_id":"...","status":"HANDOFF_REQUESTED"}}
```

---

## 7. 검증 결과

위 절차를 그대로 실행해 확인한 것이다. 요청은 전부 **프론트 개발 서버(5173)를 거쳐**
보냈으므로 프록시 재작성(`/api/chat` → `/chat`)까지 함께 확인됐다.

| 단계 | 결과 |
| --- | --- |
| 틀린 출생연도 | `401` 「본인인증에 실패했습니다.」 |
| 맞는 출생연도 | `200`, `is_older: true`, 최초 알림 1건 포함 |
| `START_CHAT` | `IN_PROGRESS`, `question_step: 1`, 보이스피싱↔메신저피싱 판별 질문 |
| 답변 전송 | `SUFFICIENT` → `question_step` +1, `chat_answers.is_adopted = true` |
| 대응 가이드 | 검색 질의 3개 분해, 코퍼스가 비어 전부 0건 → B.5 문구로 채워 출력 |
| `종료할게요` | `HANDOFF_REQUESTED` + B.6 안내, 채점 집계 1행 생성 |
| 종료 후 재전송 | `409` 「고객 답변은 IN_PROGRESS 상태에서만 처리할 수 있습니다」 |
| 거래별 상태 조회 | `HANDOFF_REQUESTED` |

**화면 자체는 브라우저로 확인해야 한다.** 여기서 검증한 것은 화면이 호출하는 API 계약과
프록시까지이고, 렌더링 결과는 직접 눈으로 봐야 한다.

### 확인된 한계 (모두 백엔드 쪽이며 화면 동작과 무관하다)

- **대응 가이드가 항상 0건이다.** `cs_guide_document_chunks` 가 비어 있어서다.
  PRD 2.5 대로 0건은 상태를 바꾸지 않고 B.5 고정 문구로 채워지므로 흐름은 정상이다.
  실제 안내 문장을 보려면 가이드 코퍼스를 먼저 적재해야 한다.
- **사기 정황이 추출되지 않아 채점이 전부 0점이다.** 위 시나리오처럼 정황이 뚜렷한
  답변에도 `chat_fraud_circumstances` 가 비었고 `type_scores` 가 4유형 모두 0 이었다.
  타임아웃 때문은 아니다(120초에서도 오류 로그 없이 0건). 추출 프롬프트(A.3) 쪽 문제로 보인다.
- **최초 알림의 거래시각이 UTC 로 표기된다.** `14:03+09` 로 넣은 거래가 화면에
  `2026-08-15 05:03` 으로 나온다. `messages.md` B.1 의 예시 표기(`2026-08-15 14:03`)와 다르다.
