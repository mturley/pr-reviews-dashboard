import type { ReviewerBreakdownEntry } from "../../../../server/src/types/pr.js";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatUsername } from "@/lib/bot-users";

type StatusVariant = "success" | "warning" | "danger" | "info" | "neutral";

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

function getEntryBadge(entry: ReviewerBreakdownEntry): { label: string; variant: StatusVariant } {
  if (entry.source === "comment") {
    switch (entry.commentAction) {
      case "LGTM":
        return { label: "/lgtm", variant: "success" };
      case "APPROVE":
        return { label: "/approve", variant: "success" };
      default:
        return { label: "Commented", variant: "neutral" };
    }
  }
  // Review entries
  switch (entry.state) {
    case "APPROVED":
      return { label: "Approved", variant: "success" };
    case "CHANGES_REQUESTED":
      return { label: "Changes requested", variant: "danger" };
    case "COMMENTED":
      return { label: "Commented", variant: "neutral" };
    case "DISMISSED":
      return { label: "Dismissed", variant: "neutral" };
    default:
      return { label: entry.state.replace(/_/g, " "), variant: "neutral" };
  }
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
          {sorted.map((entry, i) => {
            const badge = getEntryBadge(entry);
            return (
              <div key={`${entry.username}-${entry.source}-${i}`} className="flex items-center gap-2 text-xs whitespace-nowrap">
                <span className="text-muted-foreground min-w-[70px]">{entry.submittedAt ? formatReviewDate(entry.submittedAt) : ""}</span>
                <span className="font-mono font-medium min-w-[100px]">{formatUsername(entry.username)}</span>
                <StatusBadge label={badge.label} variant={badge.variant} />
                {entry.source === "comment" && (
                  <span className="text-muted-foreground italic">comment</span>
                )}
                {entry.hasNewCommitsSince && (
                  <span className="text-yellow-500">⚠ commits since review</span>
                )}
              </div>
            );
          })}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
