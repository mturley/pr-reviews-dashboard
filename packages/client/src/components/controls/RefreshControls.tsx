// T049: RefreshControls component

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface RefreshControlsProps {
  autoRefresh: boolean;
  onAutoRefreshChange: (value: boolean) => void;
  onManualRefresh: () => void;
  lastRefreshedAt?: string | null;
}

export function RefreshControls({
  autoRefresh,
  onAutoRefreshChange,
  onManualRefresh,
  lastRefreshedAt,
}: RefreshControlsProps) {
  return (
    <div className="flex items-center gap-3">
      {lastRefreshedAt && (
        <span className="text-xs text-muted-foreground">
          Last: {new Date(lastRefreshedAt).toLocaleTimeString()}
        </span>
      )}
      <Button variant="outline" size="sm" onClick={onManualRefresh} className="gap-1.5">
        <RefreshCw className="h-3.5 w-3.5" />
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
    </div>
  );
}
