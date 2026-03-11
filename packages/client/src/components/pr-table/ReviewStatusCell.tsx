// T030: ReviewStatusCell component

import type { ReviewStatusResult, AuthorStatus, ReviewerStatus } from "../../../../server/src/types/pr.js";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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

function getStatusVariant(status: AuthorStatus | ReviewerStatus): StatusVariant {
  switch (status) {
    case "Approved":
      return "success";
    case "Has LGTM":
      return "success";
    case "Draft":
      return "neutral";
    case "Team Re-review Needed":
    case "Needs Additional Review":
      return "warning";
    case "New Feedback":
    case "Needs First Review":
    case "My Re-review Needed":
      return "danger";
    case "Changes Requested (by others)":
    case "My Changes Requested":
      return "neutral";
    case "Awaiting Review":
      return "info";
    default:
      return "neutral";
  }
}

interface ReviewStatusCellProps {
  result: ReviewStatusResult;
  hasCIFailure?: boolean;
}

export function ReviewStatusCell({ result, hasCIFailure }: ReviewStatusCellProps) {
  const hasBreakdown = result.reviewerBreakdown.length > 0;

  const content = (
    <div className="flex flex-col items-start gap-0.5">
      <StatusBadge label={result.status} variant={getStatusVariant(result.status)} />
      {hasCIFailure && (
        <StatusBadge label="CI Failed" variant="danger" />
      )}
      {result.parenthetical && (
        <span className="text-xs text-muted-foreground">{result.parenthetical}</span>
      )}
    </div>
  );

  if (!hasBreakdown) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help">{content}</div>
      </TooltipTrigger>
      <TooltipContent className="max-w-lg p-3 bg-popover text-popover-foreground border border-border shadow-lg">
        <div className="space-y-2">
          <p className="text-xs font-semibold">Reviewer Breakdown</p>
          {[...result.reviewerBreakdown].sort((a, b) => {
            if (!a.submittedAt && !b.submittedAt) return 0;
            if (!a.submittedAt) return 1;
            if (!b.submittedAt) return -1;
            return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
          }).map((entry) => (
            <div key={entry.username} className="flex items-center gap-2 text-xs whitespace-nowrap">
              <span className="text-muted-foreground min-w-[70px]">{entry.submittedAt ? formatReviewDate(entry.submittedAt) : ""}</span>
              <span className="font-mono font-medium min-w-[100px]">{entry.username}</span>
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
