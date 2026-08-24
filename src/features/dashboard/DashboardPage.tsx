import { useEffect, useRef, useState } from "react";
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
  return transaction.transaction_datetime || transaction.received_at || transaction.created_at;
}

function LiveTransactionAlerts({
  transactions,
  onNewTransaction,
}: {
  transactions: RecentTransaction[];
  onNewTransaction: (isFraud: boolean) => void;
}) {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [isFraudAlertOpen, setIsFraudAlertOpen] = useState(false);
  const latestTransactionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const fraudTransactions = transactions.filter((transaction) => transaction.predict_result === true);
  const latestTransaction = transactions[0];
  const latestTransactionKey = latestTransaction
    ? `${latestTransaction.transaction_id}:${getReceivedTime(latestTransaction)}`
    : null;
  const isLatestTransactionFraud = latestTransaction?.predict_result === true;

  useEffect(() => {
    if (!latestTransactionKey) return;

    // 첫 조회는 기존 기록이므로 깜빡이지 않고, 새 이상 거래가 들어온 순간만 알린다.
    if (
      latestTransactionKeyRef.current !== null &&
      latestTransactionKeyRef.current !== latestTransactionKey
    ) {
      onNewTransaction(isLatestTransactionFraud);
    }

    latestTransactionKeyRef.current = latestTransactionKey;
  }, [isLatestTransactionFraud, latestTransactionKey, onNewTransaction]);

  function openFraudAlert() {
    setIsFraudAlertOpen((current) => !current);
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
          aria-label={isLatestTransactionFraud ? "이상 거래 발생: 최근 사기 의심 거래 목록 보기" : "정상: 최근 사기 의심 거래 목록 보기"}
          className={`dashboard-live-button ${isLatestTransactionFraud ? "fraud" : "normal"} ${isFraudAlertOpen ? "selected" : ""}`}
          onClick={openFraudAlert}
          type="button"
        >
          <span>{isLatestTransactionFraud ? "이상 거래 발생" : "정상"}</span>
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

function DashboardLoadingSkeleton() {
  return (
    <AppLayout activeNav="dashboard">
      <div aria-busy="true" aria-label="이상거래 감시 데이터를 불러오는 중" className="dashboard-content dashboard-loading" id="main">
        <header className="app-page-header dashboard-header">
          <PageHeading eyebrow="FRAUD MONITORING" title="이상거래 감시" />
          <span className="dashboard-loading-header ops-loading-block" />
        </header>

        <section className="metric-grid">
          {Array.from({ length: 4 }, (_, index) => (
            <article className="metric-card dashboard-loading-metric ops-loading-skeleton" key={index}>
              <i className="ops-loading-block" />
              <i className="ops-loading-block" />
              <i className="ops-loading-block" />
            </article>
          ))}
        </section>

        <section className="dashboard-monitoring-grid dashboard-loading-grid">
          <div className="monitoring-top-row">
            <article className="panel dashboard-loading-panel ops-loading-skeleton">
              <i className="ops-loading-block" />
              <i className="ops-loading-block" />
              <i className="ops-loading-block chart" />
            </article>
            <article className="panel dashboard-loading-panel ops-loading-skeleton">
              <i className="ops-loading-block" />
              <i className="ops-loading-block" />
              <i className="ops-loading-block chart" />
            </article>
          </div>
          <div className="monitoring-bottom-row">
            <article className="panel dashboard-loading-panel ops-loading-skeleton">
              <i className="ops-loading-block" />
              <i className="ops-loading-block" />
              <i className="ops-loading-block rows" />
            </article>
            <div className="bottom-right-col">
              {Array.from({ length: 2 }, (_, index) => (
                <article className="panel dashboard-loading-panel ops-loading-skeleton" key={index}>
                  <i className="ops-loading-block" />
                  <i className="ops-loading-block" />
                  <i className="ops-loading-block chart" />
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

export function DashboardPage() {
  const [period, setPeriod] = useState(CURRENT_PERIOD);
  const [isFraudFlashActive, setIsFraudFlashActive] = useState(false);
  const {
    data,
    realtimeRiskRows,
    recentTransactions,
    isLoading,
    errorMessage,
    isRefreshingInsight,
    refreshAgentInsight,
  } = useDashboardOverview(period);

  function showTransactionSignal(isFraud: boolean) {
    if (!isFraud) return;

    // 연속 이상 거래가 들어오면 애니메이션을 처음부터 다시 시작한다.
    setIsFraudFlashActive(false);
    window.requestAnimationFrame(() => setIsFraudFlashActive(true));
  }

  useEffect(() => {
    if (!isFraudFlashActive) return;
    const timer = window.setTimeout(() => setIsFraudFlashActive(false), 4_000);
    return () => window.clearTimeout(timer);
  }, [isFraudFlashActive]);

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

  if (isLoading && !data) return <DashboardLoadingSkeleton />;
  if (errorMessage && !data) return <main className="dashboard-state">오류: {errorMessage}</main>;
  if (!data) return <main className="dashboard-state">표시할 데이터가 없습니다.</main>;

  return (
    <AppLayout activeNav="dashboard">
      <div className={`dashboard-content ${isFraudFlashActive ? "fraud-flash" : ""}`} id="main">
        <header className="app-page-header dashboard-header">
          <PageHeading eyebrow="FRAUD MONITORING" title="이상거래 감시" />
          <LiveTransactionAlerts
            transactions={recentTransactions}
            onNewTransaction={showTransactionSignal}
          />
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
