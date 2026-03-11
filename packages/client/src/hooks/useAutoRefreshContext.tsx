// Shared auto-refresh state across all tabs

import { createContext, useContext, useState, type ReactNode } from "react";

interface AutoRefreshState {
  autoRefresh: boolean;
  setAutoRefresh: (value: boolean) => void;
  intervalMs: number;
  setIntervalMs: (value: number) => void;
  refetchInterval: number | false;
}

const AutoRefreshContext = createContext<AutoRefreshState | null>(null);

export function AutoRefreshProvider({
  defaultIntervalMs = 300_000,
  children,
}: {
  defaultIntervalMs?: number;
  children: ReactNode;
}) {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [intervalMs, setIntervalMs] = useState(defaultIntervalMs);

  return (
    <AutoRefreshContext.Provider
      value={{
        autoRefresh,
        setAutoRefresh,
        intervalMs,
        setIntervalMs,
        refetchInterval: autoRefresh ? intervalMs : false,
      }}
    >
      {children}
    </AutoRefreshContext.Provider>
  );
}

export function useAutoRefreshContext(): AutoRefreshState {
  const ctx = useContext(AutoRefreshContext);
  if (!ctx) {
    throw new Error("useAutoRefreshContext must be used within AutoRefreshProvider");
  }
  return ctx;
}
