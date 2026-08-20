// EventSource로 SSE 수신 후 overview 재조회

import { useEffect, useState } from "react";

import {
    fetchDashboardOverview,
    generateDashboardInsight,
    type DashOverviewParams,
} from "./DashboardOverviewApi";
import type { DashboardOverviewResponse } from "./dashboardOverviewTypes";

const REFRESH_DEBOUNCE_MS = 500;

export function useDashboardOverview(params: DashOverviewParams){
    const [data, setData] = useState<DashboardOverviewResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        let isActive = true;
        let refreshTimer: number | null = null;

        async function loadOverview(generateIfMissing = false){
            try {
                const overview = await fetchDashboardOverview(params);

                if (!isActive) {
                    return;
                }

                setData(overview);
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

        function scheduleRefresh(){
            if(refreshTimer !== null){
                window.clearTimeout(refreshTimer);
            }

            refreshTimer = window.setTimeout(
                () => void loadOverview(),
                REFRESH_DEBOUNCE_MS,
            );
        }

        // 화면 첫 진입 시 overview 조회
        void loadOverview(true);

        // SSE 연결
        const eventSource = new EventSource("/api/dashboard/events");

        eventSource.addEventListener("dashboard_updated", () => {
            scheduleRefresh();
        });

        return () => {
            isActive = false;

            if(refreshTimer !== null){
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
        isLoading,
        errorMessage,
        isRefreshingInsight,
        refreshAgentInsight,
        setData,
    };
}
