import { Check, X, Minus, Loader2 } from "lucide-react";
import type { LoadingPhase } from "@/hooks/useProgressiveData";

interface LoadingProgressProps {
  phases: LoadingPhase[];
}

function StatusIcon({ status }: { status: LoadingPhase["status"] }) {
  switch (status) {
    case "done":
      return <Check className="h-4 w-4 text-green-600 dark:text-green-400" />;
    case "active":
      return <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />;
    case "error":
      return <X className="h-4 w-4 text-red-600 dark:text-red-400" />;
    case "skipped":
      return <Minus className="h-4 w-4 text-muted-foreground" />;
    case "pending":
    default:
      return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />;
  }
}

export function LoadingProgress({ phases }: LoadingProgressProps) {
  const allDoneOrSkipped = phases.every((p) => p.status === "done" || p.status === "skipped");
  if (allDoneOrSkipped) return null;

  return (
    <div className="flex items-center gap-6 rounded-lg border border-border bg-card px-4 py-2.5 text-sm">
      <span className="font-medium text-muted-foreground">Loading:</span>
      {phases.map((phase) => (
        <div
          key={phase.label}
          className={`flex items-center gap-2 ${
            phase.status === "pending" ? "text-muted-foreground/50" : ""
          }`}
        >
          <StatusIcon status={phase.status} />
          <span className={phase.status === "active" ? "font-medium" : ""}>
            {phase.label}
          </span>
          {phase.detail && (
            <span className={`text-xs ${
              phase.status === "error"
                ? "text-red-600 dark:text-red-400"
                : "text-muted-foreground"
            }`}>
              {phase.detail}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
