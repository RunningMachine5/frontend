// fetchDashboardOverview()로 백엔드 api 호출

import type {
    ApiResponse,
    DashboardOverviewResponse
} from "./dashboardOverviewTypes";

export type DashOverviewParams = { // 기간 받기
    periodStart: string;
    periodEnd: string;
};

export async function fetchDashboardOverview(
    params: DashOverviewParams,
): Promise<DashboardOverviewResponse>{
    const query = new URLSearchParams({
        period_start: params.periodStart,
        period_end: params.periodEnd
    });

    // 백엔드에 api/dashboard/overview 요청
    const response = await fetch(`/api/dashboard/overview?${query}`);

    const result: ApiResponse<DashboardOverviewResponse> =
        await response.json();

    if (!response.ok || !result.success || !result.data){
        throw new Error(result.error?.message ?? "대시보드 조회에 실패함");
    }

    // 공통 응답의 data만 꺼내서 반환함
    return result.data;
}
