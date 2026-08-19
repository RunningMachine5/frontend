type LiveStatusProps = {
  label: string;
};

// 실시간 연결 상태는 모든 운영 화면에서 같은 크기와 색으로 보여준다.
export function LiveStatus({ label }: LiveStatusProps) {
  return <div className="app-live-status"><i />{label}</div>;
}
