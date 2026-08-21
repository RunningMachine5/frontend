// EventSource로 SSE 수신 후 overview 재조회

import { useEffect, useState } from "react";

import {
    fetchDashboardOverview,
    generateDashboardInsight,
    type DashOverviewParams,
} from "./DashboardOverviewApi";
import type { DashboardOverviewResponse } from "./dashboardOverviewTypes";
import { fetchQueueRows } from "../queue/queueApi";
import type { CaseListItem } from "../queue/queueTypes";

const REFRESH_INTERVAL_MS = 300;
const REALTIME_RISK_PAGE_SIZE = 100;
const REALTIME_RISK_FILTERS = {
    transactionId: "",
    ipAddress: "",
    riskGrades: [],
    periodStart: "",
    periodEnd: "",
    page: 1,
};

export function useDashboardOverview(params: DashOverviewParams){
    const [data, setData] = useState<DashboardOverviewResponse | null>(null);
    const [realtimeRiskRows, setRealtimeRiskRows] = useState<CaseListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        let isActive = true;
        let refreshTimer: number | null = null;
        let isRefreshRunning = false;
        let refreshPending = false;

        async function loadOverview(generateIfMissing = false){
            try {
                const [overview, riskRows] = await Promise.all([
                    fetchDashboardOverview(params),
                    fetchQueueRows(
                        REALTIME_RISK_FILTERS,
                        REALTIME_RISK_PAGE_SIZE,
                        "received_at",
                    ),
                ]);

                if (!isActive) {
                    return;
                }

                setData(overview);
                setRealtimeRiskRows(riskRows.items);
                setErrorMessage(null);

                // 첫 조회에 해당 기간 요약이 없을 때만 한 번 생성한다.
                if (generateIfMissing && overview.agent_insight === null) {
                    const insight = await generateDashboardInsight(params);

                    if (isActive) {
                        setData({
                            ...overview,
                            agent_insight: insight,
                        });
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

        // 화면 첫 진입 시 overview 조회
        void runRefresh(true);

        const eventSource = new EventSource("/api/dashboard/events");
        eventSource.addEventListener("dashboard_updated", scheduleRefresh);

        return () => {
            isActive = false;

            if (refreshTimer !== null) {
                window.clearTimeout(refreshTimer);
            }

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
        isLoading,
        errorMessage,
        isRefreshingInsight,
        refreshAgentInsight,
        setData,
    };
}
