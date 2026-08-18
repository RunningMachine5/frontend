import { useState, type FormEvent } from "react";

export function AdminAccess({
  token,
  onSave,
}: {
  token: string;
  onSave: (token: string) => void;
}) {
  const [value, setValue] = useState("");

  if (token) {
    return (
      <div className="admin-connection" role="status">
        <i />관리 API 연결됨
        <button onClick={() => onSave("")} type="button">연결 해제</button>
      </div>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (value.trim()) onSave(value);
  };

  return (
    <form className="admin-gate" onSubmit={submit}>
      <div>
        <p className="admin-eyebrow">ADMIN ACCESS</p>
        <h2>관리 API 연결이 필요합니다</h2>
        <p>운영·로컬 Backend의 MLOps 관리 토큰을 입력하면 이 탭을 닫기 전까지 보관합니다.</p>
      </div>
      <div className="admin-gate-controls">
        <label>
          <span>관리 토큰</span>
          <input
            autoComplete="off"
            name="mlops-admin-token"
            onChange={(event) => setValue(event.target.value)}
            placeholder="X-MLOps-Admin-Token"
            type="password"
            value={value}
          />
        </label>
        <button className="admin-button primary" type="submit">연결하기</button>
      </div>
    </form>
  );
}
