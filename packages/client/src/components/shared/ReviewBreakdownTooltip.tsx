import type { ReviewerBreakdownEntry } from "../../../../server/src/types/pr.js";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatUsername } from "@/lib/bot-users";

function formatReviewDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

interface ReviewBreakdownTooltipProps {
  breakdown: ReviewerBreakdownEntry[];
  children: React.ReactNode;
}

export function ReviewBreakdownTooltip({ breakdown, children }: ReviewBreakdownTooltipProps) {
  const submitted = breakdown.filter((e) => e.state !== "PENDING");
  if (submitted.length === 0) return <>{children}</>;

  const sorted = [...submitted].sort((a, b) => {
    if (!a.submittedAt && !b.submittedAt) return 0;
    if (!a.submittedAt) return 1;
    if (!b.submittedAt) return -1;
    return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help">{children}</div>
      </TooltipTrigger>
      <TooltipContent className="max-w-lg p-3 bg-popover text-popover-foreground border border-border shadow-lg">
        <div className="space-y-2">
          <p className="text-xs font-semibold">Reviewer Breakdown</p>
          {sorted.map((entry) => (
            <div key={entry.username} className="flex items-center gap-2 text-xs whitespace-nowrap">
              <span className="text-muted-foreground min-w-[70px]">{entry.submittedAt ? formatReviewDate(entry.submittedAt) : ""}</span>
              <span className="font-mono font-medium min-w-[100px]">{formatUsername(entry.username)}</span>
              <StatusBadge
                label={entry.state.replace(/_/g, " ")}
                variant={entry.state === "APPROVED" ? "success" : entry.state === "CHANGES_REQUESTED" ? "danger" : "neutral"}
              />
              {entry.hasNewCommitsSince && (
                <span className="text-yellow-500">⚠ commits since review</span>
              )}
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
