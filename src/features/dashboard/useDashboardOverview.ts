// EventSource로 SSE 수신 후 overview 재조회

import { useEffect, useState } from "react";

import {
    fetchDashboardOverview,
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

        async function loadOverview(){
            try {
                const overview = await fetchDashboardOverview(params);

                if (isActive) {
                    setData(overview);
                    setErrorMessage(null);
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
        void loadOverview();

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

    return {data, isLoading, errorMessage};
}
