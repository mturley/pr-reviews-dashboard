// T030: ReviewStatusCell component

import type { ReviewStatusResult, AuthorStatus, ReviewerStatus } from "../../../../server/src/types/pr.js";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type StatusVariant = "success" | "warning" | "danger" | "info" | "neutral";

function getStatusVariant(status: AuthorStatus | ReviewerStatus): StatusVariant {
  switch (status) {
    case "Approved":
      return "success";
    case "Has LGTM":
      return "success";
    case "Draft":
      return "neutral";
    case "New Feedback":
    case "My Re-review Needed":
    case "Needs First Review":
    case "Team Re-review Needed":
    case "Needs Additional Review":
      return "warning";
    case "Changes Requested (by others)":
    case "My Changes Requested":
      return "danger";
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
      <TooltipContent className="max-w-xs">
        <div className="space-y-1">
          <p className="text-xs font-medium">Reviewer Breakdown</p>
          {result.reviewerBreakdown.map((entry) => (
            <div key={entry.username} className="flex items-center gap-2 text-xs">
              <span className="font-mono">{entry.username}</span>
              <span className="rounded border px-1 py-0 text-[10px] font-medium" style={{
                backgroundColor: entry.state === "APPROVED" ? "#dcfce7" : entry.state === "CHANGES_REQUESTED" ? "#fee2e2" : "#f1f5f9",
                color: entry.state === "APPROVED" ? "#166534" : entry.state === "CHANGES_REQUESTED" ? "#991b1b" : "#64748b",
                borderColor: entry.state === "APPROVED" ? "#bbf7d0" : entry.state === "CHANGES_REQUESTED" ? "#fecaca" : "#e2e8f0",
              }}>
                {entry.state}
              </span>
              {entry.hasNewCommitsSince && (
                <span className="text-yellow-600 dark:text-yellow-400">⚠ commits since review</span>
              )}
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
