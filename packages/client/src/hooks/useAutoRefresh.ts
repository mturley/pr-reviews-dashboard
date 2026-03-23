// T048: useAutoRefresh hook

import { useState } from "react";

interface UseAutoRefreshResult {
  autoRefresh: boolean;
  setAutoRefresh: (value: boolean) => void;
  intervalMs: number;
  setIntervalMs: (value: number) => void;
  refetchInterval: number | false;
}

export function useAutoRefresh(defaultIntervalMs = 300_000): UseAutoRefreshResult {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [intervalMs, setIntervalMs] = useState(defaultIntervalMs);

  return {
    autoRefresh,
    setAutoRefresh,
    intervalMs,
    setIntervalMs,
    refetchInterval: autoRefresh ? intervalMs : false,
  };
}
