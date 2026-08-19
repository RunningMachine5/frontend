// 관리 화면에서 공통으로 쓰는 닫을 수 있는 알림이다.

type AdminAlertProps = {
  message: string;
  tone: "error" | "success";
  onDismiss: () => void;
};

export function AdminAlert({ message, tone, onDismiss }: AdminAlertProps) {
  const isError = tone === "error";

  return (
    <div className={`admin-alert ${tone} dismissible`}>
      <span role={isError ? "alert" : "status"}>{message}</span>
      <button
        aria-label={`${isError ? "오류" : "성공"} 알림 닫기`}
        className="admin-alert-dismiss"
        onClick={onDismiss}
        type="button"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
