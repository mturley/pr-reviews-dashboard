// T030: ReviewStatusCell component

import type { ReviewStatusResult, AuthorStatus, ReviewerStatus } from "../../../../server/src/types/pr.js";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReviewBreakdownTooltip } from "@/components/shared/ReviewBreakdownTooltip";

type StatusVariant = "success" | "warning" | "danger" | "info" | "neutral" | "purple";

function getStatusVariant(status: AuthorStatus | ReviewerStatus, hasAction?: boolean): StatusVariant {
  switch (status) {
    case "Merged":
      return "purple";
    case "Approved":
      return "success";
    case "Has LGTM":
      return "success";
    case "WIP":
      return hasAction ? "warning" : "neutral";
    case "Team Re-review Needed":
    case "Needs Additional Review":
      return "warning";
    case "New Feedback":
    case "Needs First Review":
    case "I'm mentioned":
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
  const content = (
    <div className="flex flex-col items-start gap-0.5">
      <StatusBadge label={result.status} variant={getStatusVariant(result.status, result.action != null)} />
      {hasCIFailure && (
        <StatusBadge label="CI Failed" variant="danger" />
      )}
      {result.parenthetical && (
        <span className="text-xs text-muted-foreground">{result.parenthetical}</span>
      )}
    </div>
  );

  return (
    <ReviewBreakdownTooltip breakdown={result.reviewerBreakdown} pushedAt={result.pushedAt} pushDates={result.pushDates}>
      {content}
    </ReviewBreakdownTooltip>
  );
}
