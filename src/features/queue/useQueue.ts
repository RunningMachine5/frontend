import { useEffect, useState } from "react";

import { parseDashboardTransactionPatch } from "../dashboard/dashboardPatch";
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
    let isRefreshRunning = false;
    let refreshPending = false;
    let hasConnected = false;

    async function loadQueue(showLoading: boolean) {
      if (showLoading) setIsLoading(true);

      try {
        // 1. 현재 페이지 테이블 데이터 조회
        const pageResult = await fetchQueueRows(filters, pageSize);
        if (!active) return;
        setRows(pageResult.items);
        setTotalCount(pageResult.total_count);

        // 2. 그래프용 최근 이상거래 기록 조회 (백엔드 허용 최대 100건)
        // 필터 조건(검색어, 기간 등)을 동일하게 적용한다.
        const allResult = await fetchQueueRows(
          { ...filters, page: 1 },
          100,
          "received_at",
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

    async function runRefresh(showLoading: boolean) {
      refreshTimer = null;
      refreshPending = false;
      isRefreshRunning = true;

      await loadQueue(showLoading);

      isRefreshRunning = false;

      // 조회 중 이벤트가 왔다면 최신 상태를 한 번 더 조회한다.
      if (active && refreshPending) scheduleRefresh();
    }

    function scheduleRefresh() {
      refreshPending = true;

      // 예약된 조회나 실행 중인 조회가 있으면 이벤트만 모아 둔다.
      if (refreshTimer !== null || isRefreshRunning) return;

      refreshTimer = window.setTimeout(
        () => void runRefresh(false),
        REFRESH_INTERVAL_MS,
      );
    }

    function handleDashboardUpdated(event: Event) {
      if (!(event instanceof MessageEvent)) {
        scheduleRefresh();
        return;
      }

      const patch = parseDashboardTransactionPatch(event.data);
      if (patch) {
        // 정상 거래는 처리 목록에 나타나지 않으므로 재조회하지 않는다.
        if (patch.suspicious_case) scheduleRefresh();
        return;
      }

      // Agent 완료 알림과 기존 payload는 DB 최종 상태로 다시 맞춘다.
      scheduleRefresh();
    }

    function handleOpen() {
      if (hasConnected) scheduleRefresh();
      hasConnected = true;
    }

    void runRefresh(true);

    const eventSource = new EventSource("/api/dashboard/events");
    eventSource.addEventListener("dashboard_updated", handleDashboardUpdated);
    eventSource.addEventListener("open", handleOpen);

    return () => {
      active = false;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      eventSource.close();
    };
  }, [filters, pageSize]);

  return { rows, trendRows, totalCount, isLoading, errorMessage };
}
