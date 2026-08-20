// EventSource로 SSE 수신 후 overview 재조회

import { useEffect, useState } from "react";

import {
    fetchDashboardOverview,
    generateDashboardInsight,
    type DashOverviewParams,
} from "./DashboardOverviewApi";
import type { DashboardOverviewResponse } from "./dashboardOverviewTypes";
import type { DashboardPatch } from "./dashboardOverviewTypes";

function mergePoints<T extends { date: string }>(
    current: T[],
    changed?: T[],
): T[] {
    if (!changed) return current;

    const changedByDate = new Map(changed.map((point) => [point.date, point]));
    const merged = current.map((point) => changedByDate.get(point.date) ?? point);
    const missing = changed.filter((point) => !current.some((item) => item.date === point.date));
    return [...merged, ...missing];
}

function applyPatch(
    current: DashboardOverviewResponse,
    patch: DashboardPatch,
): DashboardOverviewResponse {
    return {
        ...current,
        summary: patch.summary ?? current.summary,
        priority_trend: mergePoints(current.priority_trend, patch.priority_trend),
        suspicious_trend: mergePoints(current.suspicious_trend, patch.suspicious_trend),
        risk_grade_distribution: patch.risk_grade_distribution ?? current.risk_grade_distribution,
        channel_distribution: patch.channel_distribution ?? current.channel_distribution,
        agent_insight: "agent_insight" in patch
            ? patch.agent_insight ?? null
            : current.agent_insight,
    };
}

export function useDashboardOverview(params: DashOverviewParams){
    const [data, setData] = useState<DashboardOverviewResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        let isActive = true;
        let latestVersion = 0;

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

        // 화면 첫 진입 시 overview 조회
        void loadOverview(true);

        const eventQuery = new URLSearchParams({
            period_start: params.periodStart,
            period_end: params.periodEnd,
        });
        const eventSource = new EventSource(`/api/dashboard/events?${eventQuery}`);

        eventSource.addEventListener("dashboard_patch", (event) => {
            const patch = JSON.parse(event.data) as DashboardPatch;
            if (patch.version <= latestVersion) return;

            latestVersion = patch.version;
            setData((current) => current ? applyPatch(current, patch) : current);
        });

        return () => {
            isActive = false;

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
