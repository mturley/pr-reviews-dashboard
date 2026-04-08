// Shared auto-refresh state across all tabs

import { createContext, useContext, useState, useRef, useCallback, type ReactNode, type MutableRefObject } from "react";

interface AutoRefreshState {
  autoRefresh: boolean;
  setAutoRefresh: (value: boolean) => void;
  intervalMs: number;
  setIntervalMs: (value: number) => void;
  refetchInterval: number | false;
  signalManualRefresh: () => void;
  manualRefreshRef: MutableRefObject<boolean>;
}

const AutoRefreshContext = createContext<AutoRefreshState | null>(null);

export function AutoRefreshProvider({
  defaultIntervalMs = 300_000,
  children,
}: {
  defaultIntervalMs?: number;
  children: ReactNode;
}) {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [intervalMs, setIntervalMs] = useState(defaultIntervalMs);
  const manualRefreshRef = useRef(false);
  const signalManualRefresh = useCallback(() => {
    manualRefreshRef.current = true;
  }, []);

  return (
    <AutoRefreshContext.Provider
      value={{
        autoRefresh,
        setAutoRefresh,
        intervalMs,
        setIntervalMs,
        refetchInterval: autoRefresh ? intervalMs : false,
        signalManualRefresh,
        manualRefreshRef,
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
