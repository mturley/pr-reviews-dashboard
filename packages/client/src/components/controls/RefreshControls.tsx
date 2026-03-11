// T049: RefreshControls component

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  return (
    <div className="flex items-center gap-3">
      {lastRefreshedAt && (
        <span className="text-xs text-muted-foreground">
          Last: {new Date(lastRefreshedAt).toLocaleTimeString()}
        </span>
      )}
      <Button variant="outline" size="sm" onClick={onManualRefresh} disabled={isFetching} className="gap-1.5">
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
