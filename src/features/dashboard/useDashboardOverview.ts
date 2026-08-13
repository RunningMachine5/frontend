// 첫 조회 + 10초 폴링

import { useEffect, useState } from "react";

import {
    fetchDashboardOverview,
    type DashOverviewParams,
} from "./DashboardOverviewApi";
import type { DashboardOverviewResponse } from "./dashboardOverviewTypes";

const POLLING_INTERVAL_MS = 10_000;

export function useDashboardOverview(params: DashOverviewParams){
    const [data, setData] = useState<DashboardOverviewResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        let isActive = true;

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

        void loadOverview();

        const intervalId = window.setInterval(
            () => void loadOverview(),
            POLLING_INTERVAL_MS,
        );

        return () => {
            isActive = false;
            window.clearInterval(intervalId);
        };
    }, [params.periodStart, params.periodEnd]);

    return {data, isLoading, errorMessage};
}
