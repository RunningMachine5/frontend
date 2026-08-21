import { useState, type FormEvent } from "react";

import type { FraudRuleTypeInput } from "./ruleTypes";

type CreateFraudTypeDialogProps = {
  error: string | null;
  isBusy: boolean;
  onClose: () => void;
  onCreate: (input: FraudRuleTypeInput) => void;
};

const TYPE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;

export function CreateFraudTypeDialog({
  error,
  isBusy,
  onClose,
  onCreate,
}: CreateFraudTypeDialogProps) {
  const [displayName, setDisplayName] = useState("");
  const [typeCode, setTypeCode] = useState("");
  const [description, setDescription] = useState("");
  const canSubmit = displayName.trim().length > 0 && TYPE_CODE_PATTERN.test(typeCode);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || isBusy) return;
    onCreate({
      display_name: displayName.trim(),
      type_code: typeCode,
      description: description.trim() || null,
    });
  };

  return (
    <div className="admin-dialog-backdrop" onMouseDown={onClose} role="presentation">
      <form
        aria-labelledby="create-fraud-type-title"
        aria-modal="true"
        className="admin-dialog fraud-type-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submit}
        role="dialog"
      >
        <header>
          <div>
            <p className="admin-eyebrow">NEW FRAUD TYPE</p>
            <h2 id="create-fraud-type-title">사기유형 추가</h2>
          </div>
          <button disabled={isBusy} onClick={onClose} type="button">닫기</button>
        </header>

        <p className="dialog-help">
          유형을 먼저 만든 뒤 해당 탭에서 탐지 패턴과 가중치를 구성합니다.
        </p>

        <div className="fraud-type-form-grid">
          <label>
            <span>화면 표시 이름</span>
            <input
              autoFocus
              maxLength={128}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="예: 대출 사기"
              value={displayName}
            />
          </label>
          <label>
            <span>유형 코드</span>
            <input
              maxLength={64}
              onChange={(event) => setTypeCode(
                event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""),
              )}
              placeholder="예: LOAN_FRAUD"
              value={typeCode}
            />
            <small>영문 대문자와 숫자, 밑줄만 사용할 수 있습니다.</small>
          </label>
          <label>
            <span>설명 <em>선택</em></span>
            <textarea
              maxLength={1000}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="담당자가 구분할 수 있는 간단한 설명"
              rows={3}
              value={description}
            />
          </label>
        </div>

        <div className="fraud-type-policy-note">
          <strong>추가 후 상태 · 준비 중</strong>
          <span>Agent 대응 정책이 연결되기 전까지 운영 탐지에는 사용되지 않습니다.</span>
        </div>

        {error && <p className="fraud-type-dialog-error" role="alert">{error}</p>}

        <div className="pattern-dialog-actions">
          <button className="admin-button" disabled={isBusy} onClick={onClose} type="button">취소</button>
          <button className="admin-button primary" disabled={!canSubmit || isBusy} type="submit">
            {isBusy ? "추가 중..." : "사기유형 추가"}
          </button>
        </div>
      </form>
    </div>
  );
}
