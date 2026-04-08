// T049: RefreshControls component

import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { useAutoRefreshContext } from "@/hooks/useAutoRefreshContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function useManualRefreshHandler(onManualRefresh: () => void) {
  const { signalManualRefresh } = useAutoRefreshContext();
  return useCallback(() => {
    signalManualRefresh();
    onManualRefresh();
  }, [signalManualRefresh, onManualRefresh]);
}

interface RefreshControlsProps {
  autoRefresh: boolean;
  onAutoRefreshChange: (value: boolean) => void;
  intervalMs: number;
  onIntervalChange: (value: number) => void;
  onManualRefresh: () => void;
  lastRefreshedAt?: string | null;
  isFetching?: boolean;
}

const INTERVAL_OPTIONS = [
  { value: 60_000, label: "1 min" },
  { value: 120_000, label: "2 min" },
  { value: 300_000, label: "5 min" },
  { value: 600_000, label: "10 min" },
  { value: 1_800_000, label: "30 min" },
  { value: 3_600_000, label: "1 hour" },
];

export function RefreshControls({
  autoRefresh,
  onAutoRefreshChange,
  intervalMs,
  onIntervalChange,
  onManualRefresh,
  lastRefreshedAt,
  isFetching,
}: RefreshControlsProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const isStale = lastRefreshedAt
    ? now - new Date(lastRefreshedAt).getTime() > 5 * 60 * 1000
    : false;

  return (
    <div className="flex items-center gap-3">
      {lastRefreshedAt && (isStale && isFetching ? (
        <span className="text-xs text-amber-600 dark:text-amber-400">
          Data from {new Date(lastRefreshedAt).toLocaleTimeString()} — refreshing…
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">
          Last: {new Date(lastRefreshedAt).toLocaleTimeString()}
        </span>
      ))}
      <Button variant="outline" size="sm" onClick={useManualRefreshHandler(onManualRefresh)} disabled={isFetching} className="gap-1.5">
        <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
        Refresh
      </Button>
      <div className="flex items-center gap-1.5">
        <Switch
          checked={autoRefresh}
          onCheckedChange={onAutoRefreshChange}
          aria-label="Toggle auto-refresh"
        />
        <span className="text-xs text-muted-foreground">Auto</span>
      </div>
      {autoRefresh && (
        <Select
          value={String(intervalMs)}
          onValueChange={(v) => onIntervalChange(Number(v))}
        >
          <SelectTrigger className="h-7 w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INTERVAL_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
