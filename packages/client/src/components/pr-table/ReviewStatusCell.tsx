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
}

export function ReviewStatusCell({ result }: ReviewStatusCellProps) {
  const hasBreakdown = result.reviewerBreakdown.length > 0;

  const content = (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <StatusBadge label={result.status} variant={getStatusVariant(result.status)} />
        {result.action && (
          <span className="text-xs font-medium text-blue-600">{result.action}</span>
        )}
      </div>
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
              <StatusBadge
                label={entry.state}
                variant={
                  entry.state === "APPROVED"
                    ? "success"
                    : entry.state === "CHANGES_REQUESTED"
                      ? "danger"
                      : "neutral"
                }
                className="text-[10px] px-1 py-0"
              />
              {entry.hasNewCommitsSince && (
                <span className="text-yellow-600">new commits</span>
              )}
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
