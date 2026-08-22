import { useEffect, useState } from "react";
import { AppLayout } from "../../components/layout/AppLayout";
import { PageHeading } from "../../components/layout/PageHeading";
import { AgentInsightPanel } from "./components/AgentInsightPanel";
import { AllTransactionTrendPanel } from "./components/AllTransactionTrendPanel";
import { ChannelDistributionPanel } from "./components/ChannelDistributionPanel";
import { DashboardSummaryCards } from "./components/DashboardSummaryCards";
import { HighRiskTrendPanel } from "./components/HighRiskTrendPanel";
import { RiskGradeDistributionPanel } from "./components/RiskGradeDistributionPanel";
import type { RecentTransaction } from "./dashboardOverviewTypes";
import { useDashboardOverview } from "./useDashboardOverview";
import "./DashboardPage.css";

function getCurrentDashboardPeriod() {
  const periodEnd = new Date();
  periodEnd.setHours(24, 0, 0, 0);

  const periodStart = new Date(periodEnd);
  periodStart.setDate(periodStart.getDate() - 6);

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  };
}

const CURRENT_PERIOD = getCurrentDashboardPeriod();
const LAST_ACKNOWLEDGED_FRAUD_KEY = "fds.lastAcknowledgedFraudTransaction";

function formatLiveTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "시간 정보 없음";

  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getReceivedTime(transaction: RecentTransaction) {
  return transaction.received_at || transaction.created_at;
}

function LiveTransactionAlerts({ transactions }: { transactions: RecentTransaction[] }) {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [isFraudAlertOpen, setIsFraudAlertOpen] = useState(false);
  const [hasUnacknowledgedFraud, setHasUnacknowledgedFraud] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const fraudTransactions = transactions.filter((transaction) => transaction.predict_result === true);
  const latestFraudTransaction = fraudTransactions[0];
  const latestFraudKey = latestFraudTransaction
    ? `${latestFraudTransaction.transaction_id}:${getReceivedTime(latestFraudTransaction)}`
    : null;

  useEffect(() => {
    if (latestFraudKey && localStorage.getItem(LAST_ACKNOWLEDGED_FRAUD_KEY) !== latestFraudKey) {
      setHasUnacknowledgedFraud(true);
    }
  }, [latestFraudKey]);

  function openFraudAlert() {
    setIsFraudAlertOpen((current) => !current);
    if (latestFraudKey) {
      localStorage.setItem(LAST_ACKNOWLEDGED_FRAUD_KEY, latestFraudKey);
      setHasUnacknowledgedFraud(false);
    }
  }

  return (
    <div className="dashboard-live-alerts">
      <time className="dashboard-clock" dateTime={currentTime.toISOString()}>
        <span>현재 시각</span>
        <strong>{formatLiveTime(currentTime.toISOString())}</strong>
      </time>
      <div className="dashboard-live-buttons" aria-label="최근 거래 알림">
        <button
          aria-expanded={isFraudAlertOpen}
          aria-label={hasUnacknowledgedFraud ? "이상 거래 발생: 최근 사기 의심 거래 목록 보기" : "정상: 최근 사기 의심 거래 목록 보기"}
          className={`dashboard-live-button fraud ${hasUnacknowledgedFraud ? "unacknowledged" : ""} ${isFraudAlertOpen ? "selected" : ""}`}
          onClick={openFraudAlert}
          type="button"
        >
          <span>{hasUnacknowledgedFraud ? "이상 거래 발생" : "정상"}</span>
        </button>
      </div>
      {isFraudAlertOpen && (
        <section className="dashboard-live-popover" aria-live="polite">
          <header>
            <strong>최근 사기 의심 거래</strong>
            <button aria-label="최근 거래 알림 닫기" onClick={() => setIsFraudAlertOpen(false)} type="button">×</button>
          </header>
          {fraudTransactions.length > 0 ? (
            <ul>
              {fraudTransactions.slice(0, 5).map((transaction) => (
                <li key={transaction.transaction_id}>
                  <span>TX-{transaction.transaction_id}</span>
                  <time>{formatLiveTime(getReceivedTime(transaction))}</time>
                  <a href={`#case?transaction_id=${transaction.transaction_id}`}>상세 분석</a>
                </li>
              ))}
            </ul>
          ) : <p>최근 수신된 거래가 없습니다.</p>}
        </section>
      )}
    </div>
  );
}

export function DashboardPage() {
  const [period, setPeriod] = useState(CURRENT_PERIOD);
  const {
    data,
    realtimeRiskRows,
    recentTransactions,
    isLoading,
    errorMessage,
    isRefreshingInsight,
    refreshAgentInsight,
  } = useDashboardOverview(period);

  const handleRefreshAgentInsight = async () => {
    // 현재 시각 기준 최근 7일(now - 7일 ~ now)로 기간 변경 및 최신 분석 실행
    const now = new Date();
    const currentEnd = new Date(now);
    const currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - 7);

    const newPeriod = {
      periodStart: currentStart.toISOString(),
      periodEnd: currentEnd.toISOString(),
    };

    setPeriod(newPeriod);
    try {
      await refreshAgentInsight(newPeriod);
    } catch {
      // 에러는 useDashboardOverview 내부에서 errorMessage로 처리됨
    }
  };

  if (isLoading && !data) return <main className="dashboard-state">대시보드를 불러오는 중...</main>;
  if (errorMessage && !data) return <main className="dashboard-state">오류: {errorMessage}</main>;
  if (!data) return <main className="dashboard-state">표시할 데이터가 없습니다.</main>;

  return (
    <AppLayout activeNav="dashboard">
      <div className="dashboard-content" id="main">
        <header className="app-page-header dashboard-header">
          <PageHeading eyebrow="FRAUD MONITORING" title="이상거래 감시" />
          <LiveTransactionAlerts transactions={recentTransactions} />
        </header>
        {errorMessage && <p className="refresh-error">최근 갱신 실패: {errorMessage}</p>}

        <DashboardSummaryCards summary={data.summary} />
        <section className="dashboard-monitoring-grid">
          {/* 상단 행: 사기 의심 거래 + 정상 거래를 포함한 전체 거래 */}
          <div className="monitoring-top-row">
            <HighRiskTrendPanel
              rows={realtimeRiskRows}
            />
            <AllTransactionTrendPanel transactions={recentTransactions} />
          </div>

          {/* 하단 행: AI 에이전트(좁게) + 위험등급별 & 채널별(넓게) */}
          <div className="monitoring-bottom-row">
            <AgentInsightPanel
              insight={data.agent_insight}
              isRefreshing={isRefreshingInsight}
              onRefresh={handleRefreshAgentInsight}
            />
            <div className="bottom-right-col">
              <RiskGradeDistributionPanel
                items={data.risk_grade_distribution}
                summary={data.summary}
              />
              <ChannelDistributionPanel
                items={data.channel_distribution}
                totalCount={data.summary.suspicious_transaction_count}
              />
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
