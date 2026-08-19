import { useEffect, useState } from "react";

import { fetchQueueRows } from "./queueApi";
import type { CaseListItem, QueueSearchFilters } from "./queueTypes";

const REFRESH_DEBOUNCE_MS = 500;

export function useQueue(filters: QueueSearchFilters) {
  const [rows, setRows] = useState<CaseListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let refreshTimer: number | null = null;

    async function loadQueue(showLoading: boolean) {
      if (showLoading) setIsLoading(true);

      try {
        const result = await fetchQueueRows(filters);
        if (!active) return;
        setRows(result.items);
        setTotalCount(result.total_count);
        setErrorMessage(null);
      } catch (error) {
        if (active) setErrorMessage(error instanceof Error ? error.message : "목록 조회에 실패했습니다.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    function scheduleRefresh() {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(
        () => void loadQueue(false),
        REFRESH_DEBOUNCE_MS,
      );
    }

    void loadQueue(true);

    const eventSource = new EventSource("/api/dashboard/events");
    eventSource.addEventListener("dashboard_updated", scheduleRefresh);

    return () => {
      active = false;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      eventSource.close();
    };
  }, [filters]);

  return { rows, totalCount, isLoading, errorMessage };
}
