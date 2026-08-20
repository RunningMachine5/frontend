import { useEffect, useState } from "react";

import { fetchQueueRows } from "./queueApi";
import type { CaseListItem, QueueSearchFilters } from "./queueTypes";

const REFRESH_INTERVAL_MS = 200;

export function useQueue(filters: QueueSearchFilters, pageSize: number) {
  const [rows, setRows] = useState<CaseListItem[]>([]);
  const [trendRows, setTrendRows] = useState<CaseListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let refreshTimer: number | null = null;

    async function loadQueue(showLoading: boolean) {
      if (showLoading) setIsLoading(true);

      try {
        // 1. 현재 페이지 테이블 데이터 조회
        const pageResult = await fetchQueueRows(filters, pageSize);
        if (!active) return;
        setRows(pageResult.items);
        setTotalCount(pageResult.total_count);

        // 2. 그래프용 전체 이상거래 기록 조회 (page: 1, pageSize: 최대 500)
        // 필터 조건(검색어, 기간 등)을 동일하게 적용하되 전체 목록을 가져옴
        const allResult = await fetchQueueRows(
          { ...filters, page: 1 },
          Math.max(pageResult.total_count, 100),
        );
        if (!active) return;
        setTrendRows(allResult.items);
        setErrorMessage(null);
      } catch (error) {
        if (active) setErrorMessage(error instanceof Error ? error.message : "목록 조회에 실패했습니다.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    function scheduleRefresh() {
      if (refreshTimer !== null) return;
      refreshTimer = window.setTimeout(
        () => {
          refreshTimer = null;
          void loadQueue(false);
        },
        REFRESH_INTERVAL_MS,
      );
    }

    void loadQueue(true);

    const eventSource = new EventSource("/api/dashboard/events");
    eventSource.addEventListener("dashboard_patch", scheduleRefresh);

    return () => {
      active = false;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      eventSource.close();
    };
  }, [filters, pageSize]);

  return { rows, trendRows, totalCount, isLoading, errorMessage };
}
