import { useMemo, useState } from "react";
import type { RecentTransaction } from "../dashboardOverviewTypes";
import {
  buildRealtimeRiskPoints,
  RealtimeRiskTrendChart,
  type TimeInterval,
} from "./HighRiskTrendPanel";

export function AllTransactionTrendPanel({
  transactions,
}: {
  transactions: RecentTransaction[];
}) {
  const [timeInterval, setTimeInterval] = useState<TimeInterval>("second");
  const items = useMemo(
    () => buildRealtimeRiskPoints(transactions, timeInterval),
    [transactions, timeInterval],
  );
  const suspiciousCount = transactions.filter((transaction) => transaction.predict_result).length;

  return (
    <article className="panel priority-panel realtime-all-panel">
      <div className="panel-head">
        <div>
          <h2>실시간 전체 거래 반영 현황</h2>
          <p className="panel-caption">정상·사기 의심 거래를 서버 수신 시각 기준으로 함께 표시합니다.</p>
        </div>
        <div className="realtime-all-meta">
          <div className="time-interval-toggle" role="group" aria-label="시간 단위 선택">
            <button
              className={timeInterval === "second" ? "active" : ""}
              onClick={() => setTimeInterval("second")}
              type="button"
            >
              초 단위
            </button>
            <button
              className={timeInterval === "minute" ? "active" : ""}
              onClick={() => setTimeInterval("minute")}
              type="button"
            >
              분 단위
            </button>
          </div>
          <span className="live-status-tag">
            <i aria-hidden="true" className="live-green-dot" />
            실시간 감시
          </span>
          <span className="trend-stat-badge">
            전체 <strong>{transactions.length}건</strong>
            <span className="divider">·</span>
            의심 <strong className="score-text">{suspiciousCount}건</strong>
          </span>
        </div>
      </div>

      {items.length > 0 ? (
        <RealtimeRiskTrendChart items={items} />
      ) : (
        <div className="agent-empty">표시할 거래가 없습니다.</div>
      )}
    </article>
  );
}
