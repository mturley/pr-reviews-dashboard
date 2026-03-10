// T048: useAutoRefresh hook

import { useState, useCallback } from "react";

interface UseAutoRefreshResult {
  autoRefresh: boolean;
  setAutoRefresh: (value: boolean) => void;
  refetchInterval: number | false;
  manualRefetch: () => void;
  registerRefetch: (refetch: () => void) => void;
}

export function useAutoRefresh(defaultIntervalMs = 300_000): UseAutoRefreshResult {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refetchFns, setRefetchFns] = useState<Array<() => void>>([]);

  const registerRefetch = useCallback((refetch: () => void) => {
    setRefetchFns((prev) => [...prev, refetch]);
  }, []);

  const manualRefetch = useCallback(() => {
    for (const fn of refetchFns) {
      fn();
    }
  }, [refetchFns]);

  return {
    autoRefresh,
    setAutoRefresh,
    refetchInterval: autoRefresh ? defaultIntervalMs : false,
    manualRefetch,
    registerRefetch,
  };
}
