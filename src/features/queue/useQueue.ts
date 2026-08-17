import { useEffect, useState } from "react";

import { fetchQueueRows, type QueueRow } from "./queueApi";

export function useQueue() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [allCount, setAllCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchQueueRows()
      .then((result) => {
        setRows(result.rows);
        setAllCount(result.allCount);
      })
      .catch((error: unknown) => setErrorMessage(error instanceof Error ? error.message : "목록 조회에 실패했습니다."))
      .finally(() => setIsLoading(false));
  }, []);

  return { rows, allCount, isLoading, errorMessage };
}
