import { useEffect, useState } from "react";

import { fetchQueueRows } from "./queueApi";
import type { CaseListItem, QueueSearchFilters } from "./queueTypes";

export function useQueue(filters: QueueSearchFilters) {
  const [rows, setRows] = useState<CaseListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setErrorMessage(null);

    fetchQueueRows(filters)
      .then((result) => {
        if (!active) return;
        setRows(result.items);
        setTotalCount(result.total_count);
      })
      .catch((error: unknown) => {
        if (active) setErrorMessage(error instanceof Error ? error.message : "목록 조회에 실패했습니다.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filters]);

  return { rows, totalCount, isLoading, errorMessage };
}
