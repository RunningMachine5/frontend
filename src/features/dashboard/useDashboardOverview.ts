// 거래 SSE는 화면에 즉시 반영하고, 기존 알림은 전체 조회로 보정한다.

import { useEffect, useState } from "react";

import {
    fetchDashboardOverview,
    fetchRecentTransactions,
    generateDashboardInsight,
    type DashOverviewParams,
} from "./DashboardOverviewApi";
import type { DashboardOverviewResponse, RecentTransaction } from "./dashboardOverviewTypes";
import {
    applyDashboardTransactionPatch,
    parseDashboardEventSource,
    parseDashboardTransactionPatch,
    upsertRealtimeRiskRow,
    upsertRecentTransaction,
} from "./dashboardPatch";
import { fetchQueueRows } from "../queue/queueApi";
import type { CaseListItem } from "../queue/queueTypes";

const REFRESH_INTERVAL_MS = 300;
const RECENT_TRANSACTION_SYNC_MS = 500;
const REALTIME_RISK_PAGE_SIZE = 100;
const REALTIME_RISK_FILTERS = {
    transactionId: "",
    ipAddress: "",
    riskGrades: [],
    reviewStatuses: [],
    periodStart: "",
    periodEnd: "",
    page: 1,
};

export function useDashboardOverview(params: DashOverviewParams){
    const [data, setData] = useState<DashboardOverviewResponse | null>(null);
    const [realtimeRiskRows, setRealtimeRiskRows] = useState<CaseListItem[]>([]);
    const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
    const [fraudAlertSequence, setFraudAlertSequence] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        let isActive = true;
        let refreshTimer: number | null = null;
        let isRefreshRunning = false;
        let refreshPending = false;
        let hasSnapshot = false;
        let hasConnected = false;
        const seenEventIds = new Set<string>();
        const seenTransactionIds = new Set<number>();

        async function loadOverview(generateIfMissing = false){
            try {
                const [overview, riskRows, recentTransactions] = await Promise.all([
                    fetchDashboardOverview(params),
                    fetchQueueRows(
                        REALTIME_RISK_FILTERS,
                        REALTIME_RISK_PAGE_SIZE,
                        "received_at",
                    ),
                    fetchRecentTransactions(),
                ]);

                if (!isActive) {
                    return;
                }

                const hasNewFraud = hasSnapshot && recentTransactions.some(
                    (transaction) =>
                        transaction.predict_result === true &&
                        !seenTransactionIds.has(transaction.transaction_id),
                );

                for (const transaction of recentTransactions) {
                    seenTransactionIds.add(transaction.transaction_id);
                    seenEventIds.add(`transaction:${transaction.transaction_id}`);
                }

                setData(overview);
                setRealtimeRiskRows(riskRows.items);
                setRecentTransactions(recentTransactions);
                if (hasNewFraud) {
                    setFraudAlertSequence((current) => current + 1);
                }
                setErrorMessage(null);
                hasSnapshot = true;

                // 첫 조회에 해당 기간 요약이 없을 때만 한 번 생성한다.
                if (generateIfMissing && overview.agent_insight === null) {
                    const insight = await generateDashboardInsight(params);

                    if (isActive) {
                        setData((current) =>
                            current
                                ? { ...current, agent_insight: insight }
                                : current,
                        );
                    }
                }
            }catch(error){
                if(isActive){
                    setErrorMessage(
                        error instanceof Error
                        ? error.message
                        : "대시보드 조회 실패"
                    );
                }
            } finally {
                if(isActive){
                    setIsLoading(false);
                }
            }
        }

        async function runRefresh(generateIfMissing = false) {
            refreshTimer = null;
            refreshPending = false;
            isRefreshRunning = true;

            await loadOverview(generateIfMissing);

            isRefreshRunning = false;

            // 조회 중 이벤트가 왔다면 최신 상태를 한 번 더 조회한다.
            if (isActive && refreshPending) {
                scheduleRefresh();
            }
        }

        async function syncRecentTransactions() {
            try {
                const latestTransactions = await fetchRecentTransactions();
                if (!isActive || !hasSnapshot) return;

                const hasNewFraud = latestTransactions.some(
                    (transaction) =>
                        transaction.predict_result === true &&
                        !seenTransactionIds.has(transaction.transaction_id),
                );

                for (const transaction of latestTransactions) {
                    seenTransactionIds.add(transaction.transaction_id);
                    seenEventIds.add(`transaction:${transaction.transaction_id}`);
                }

                setRecentTransactions(latestTransactions);
                if (hasNewFraud) {
                    setFraudAlertSequence((current) => current + 1);
                }
            } catch {
                // SSE가 정상일 때는 기존 경로가 동작하므로 보정 조회 실패는 무시한다.
            }
        }

        function scheduleRefresh() {
            refreshPending = true;

            // 예약된 조회나 실행 중인 조회가 있으면 이벤트만 모아 둔다.
            if (refreshTimer !== null || isRefreshRunning) {
                return;
            }

            refreshTimer = window.setTimeout(
                () => void runRefresh(),
                REFRESH_INTERVAL_MS,
            );
        }

        function handleDashboardUpdated(event: Event) {
            if (!(event instanceof MessageEvent)) {
                scheduleRefresh();
                return;
            }

            const patch = parseDashboardTransactionPatch(event.data);
            if (!patch) {
                // 거래 patch에 이미 대시보드 표시값이 있으므로 Agent 완료는
                // 처리 목록에서만 최종 상태를 다시 조회한다.
                if (parseDashboardEventSource(event.data) === "agent") return;
                scheduleRefresh();
                return;
            }

            // 조회와 부분 갱신이 겹치면 응답 순서에 따라 화면이 과거 값으로
            // 돌아갈 수 있으므로, 실행·예약된 조회가 끝난 뒤 DB 값으로 보정한다.
            if (!hasSnapshot || isRefreshRunning || refreshTimer !== null) {
                scheduleRefresh();
                return;
            }

            const transactionId = patch.transaction.transaction_id;
            if (
                seenEventIds.has(patch.event_id) ||
                seenTransactionIds.has(transactionId)
            ) {
                return;
            }

            seenEventIds.add(patch.event_id);
            seenTransactionIds.add(transactionId);
            if (patch.transaction.predict_result === true) {
                setFraudAlertSequence((current) => current + 1);
            }
            const suspiciousCase = patch.suspicious_case;
            setRecentTransactions((current) =>
                upsertRecentTransaction(current, patch.transaction),
            );
            setData((current) =>
                current
                    ? applyDashboardTransactionPatch(current, patch)
                    : current,
            );
            if (suspiciousCase) {
                setRealtimeRiskRows((current) =>
                    upsertRealtimeRiskRow(current, suspiciousCase),
                );
            }
        }

        function handleOpen() {
            // 최초 연결은 첫 조회가 담당하고, 실제 재연결 때만 누락 구간을 맞춘다.
            if (hasConnected) scheduleRefresh();
            hasConnected = true;
        }

        // 화면 첫 진입 시 overview 조회
        void runRefresh(true);

        const eventSource = new EventSource("/api/dashboard/events");
        eventSource.addEventListener("dashboard_updated", handleDashboardUpdated);
        eventSource.addEventListener("open", handleOpen);
        const recentSyncTimer = window.setInterval(
            () => void syncRecentTransactions(),
            RECENT_TRANSACTION_SYNC_MS,
        );

        return () => {
            isActive = false;

            if (refreshTimer !== null) {
                window.clearTimeout(refreshTimer);
            }

            window.clearInterval(recentSyncTimer);
            eventSource.close();
        };
    }, [params.periodStart, params.periodEnd]);

    const [isRefreshingInsight, setIsRefreshingInsight] = useState(false);

    async function refreshAgentInsight(customParams?: DashOverviewParams) {
        const targetParams = customParams || params;
        setIsRefreshingInsight(true);
        try {
            const insight = await generateDashboardInsight({
                ...targetParams,
                forceRefresh: true,
            });
            setData((prev) => (prev ? { ...prev, agent_insight: insight } : prev));
            setErrorMessage(null);
            return insight;
        } catch (error) {
            setErrorMessage(
                error instanceof Error ? error.message : "에이전트 분석 새로고침 실패"
            );
            throw error;
        } finally {
            setIsRefreshingInsight(false);
        }
    }

    return {
        data,
        realtimeRiskRows,
        recentTransactions,
        fraudAlertSequence,
        isLoading,
        errorMessage,
        isRefreshingInsight,
        refreshAgentInsight,
        setData,
    };
}
