import {
  CheckCircle2,
  XCircle,
  Clock,
  Tag,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { PullRequest, JiraIssueRef } from "../../../../server/src/types/pr";
import { computeReviewStatus } from "../../../../server/src/logic/review-status";
import { formatUsername } from "@/lib/bot-users";
import { trpc } from "@/trpc";
import { ReviewHistory } from "./ReviewHistory";

function formatAge(dateStr: string): string {
  const now = Date.now();
  const created = new Date(dateStr).getTime();
  const diffMs = now - created;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function CheckStatusSummary({ pr }: { pr: PullRequest }) {
  const { checkStatus } = pr;
  if (!checkStatus.state) return <span className="text-xs text-muted-foreground">No checks</span>;

  const icon = checkStatus.state === "SUCCESS" ? (
    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
  ) : checkStatus.state === "FAILURE" || checkStatus.state === "ERROR" ? (
    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
  ) : (
    <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
  );

  return (
    <div className="flex items-center gap-1.5 text-sm">
      {icon}
      <span>
        {checkStatus.totalCount} check{checkStatus.totalCount !== 1 ? "s" : ""}
        {checkStatus.state === "SUCCESS" && " passing"}
        {(checkStatus.state === "FAILURE" || checkStatus.state === "ERROR") && " — some failing"}
        {checkStatus.state === "PENDING" && " — in progress"}
      </span>
    </div>
  );
}

function PRStateLabel({ pr }: { pr: PullRequest }) {
  if (pr.state === "MERGED") return <StatusBadge label="Merged" variant="purple" />;
  if (pr.state === "CLOSED") return <StatusBadge label="Closed" variant="danger" />;
  if (pr.isDraft) return <StatusBadge label="Draft" variant="neutral" />;
  return <StatusBadge label="Open" variant="success" />;
}

type StatusVariant = "success" | "warning" | "danger" | "info" | "neutral" | "purple";

function getStatusVariant(status: string, hasAction?: boolean): StatusVariant {
  switch (status) {
    case "Merged": return "purple";
    case "Approved": case "Has LGTM": return "success";
    case "WIP": return hasAction ? "warning" : "neutral";
    case "Team Re-review Needed": case "Needs Additional Review": return "warning";
    case "New Feedback": case "Needs First Review": case "I'm mentioned": case "My Re-review Needed": return "danger";
    case "Awaiting Changes": case "Awaiting Review": return "info";
    default: return "neutral";
  }
}

function ReviewStatusBadge({ status, action }: { status: string; action: string | null }) {
  return <StatusBadge label={status} variant={getStatusVariant(status, action != null)} />;
}

interface PRDetailContentProps {
  pr: PullRequest;
  onNavigate: (jiraRef: { key: string }) => void;
}

export function PRDetailContent({ pr, onNavigate }: PRDetailContentProps) {
  const configQuery = trpc.config.get.useQuery();
  const viewer = configQuery.data?.config?.githubIdentity ?? "";
  const reviewStatus = computeReviewStatus(pr, viewer);

  return (
    <div className="grid grid-cols-[1fr_auto] gap-6">
      {/* Left column: CI, labels, jira */}
      <div className="space-y-5 min-w-0">
        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">State:</span>
            <PRStateLabel pr={pr} />
            {pr.state === "OPEN" && pr.isMergeable === false && (
              <StatusBadge label="Conflicts" variant="danger" />
            )}
          </div>
          <div>
            <span className="text-muted-foreground">Author:</span>{" "}
            <span className="font-medium">{formatUsername(pr.author)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Created:</span>{" "}
            {formatAge(pr.createdAt)}
          </div>
          <div>
            <span className="text-muted-foreground">Updated:</span>{" "}
            {formatAge(pr.updatedAt)}
          </div>
          <div>
            <span className="text-muted-foreground">Repo:</span>{" "}
            {pr.repoOwner}/{pr.repoName}
          </div>
          {pr.pushedAt && (
            <div>
              <span className="text-muted-foreground">Last push:</span>{" "}
              {formatAge(pr.pushedAt)}
            </div>
          )}
        </div>

        {/* Check status */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground mb-1.5">CI Status</h3>
          <CheckStatusSummary pr={pr} />
        </div>

        {/* Labels */}
        {pr.labels.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground mb-1.5">Labels</h3>
            <div className="flex flex-wrap gap-1">
              {pr.labels.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
                >
                  <Tag className="h-3 w-3" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Pending review requests */}
        {reviewStatus.reviewerBreakdown.filter((e) => e.state === "PENDING").length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground mb-1.5">Pending Review Requests</h3>
            <div className="flex flex-wrap gap-1">
              {reviewStatus.reviewerBreakdown
                .filter((e) => e.state === "PENDING")
                .map((e) => (
                  <span key={e.username} className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                    {formatUsername(e.username)}
                  </span>
                ))}
            </div>
          </div>
        )}

        {/* Linked Jira issues */}
        {pr.linkedJiraIssues.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground mb-1.5">Linked Jira Issues</h3>
            <div className="space-y-1.5">
              {pr.linkedJiraIssues.map((issue) => (
                <JiraRefRow key={issue.key} issue={issue} onClick={() => onNavigate(issue)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right column: Review and change history */}
      <div className="w-[400px] border-l border-border pl-5">
        <div className="flex items-center gap-2 mb-3">
          <ReviewStatusBadge status={reviewStatus.status} action={reviewStatus.action} />
          {reviewStatus.parenthetical && (
            <span className="text-xs text-muted-foreground">{reviewStatus.parenthetical}</span>
          )}
        </div>
        <h3 className="text-xs font-semibold text-muted-foreground mb-2">Review and change history</h3>
        <ReviewHistory
          breakdown={reviewStatus.reviewerBreakdown}
          pushDates={pr.pushDates}
          commits={pr.commits}
          repoOwner={pr.repoOwner}
          repoName={pr.repoName}
        />
      </div>
    </div>
  );
}

function JiraRefRow({ issue, onClick }: { issue: JiraIssueRef; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="cursor-pointer flex items-center gap-2 text-sm w-full text-left hover:bg-muted/50 rounded px-2 py-1 -mx-2 transition-colors"
    >
      {issue.typeIconUrl && <img src={issue.typeIconUrl} alt={issue.type} className="h-4 w-4" />}
      <span className="font-medium text-blue-600 dark:text-blue-400">{issue.key}</span>
      <span className="truncate text-muted-foreground">{issue.summary}</span>
      <span className="shrink-0 text-xs text-muted-foreground ml-auto">{issue.state}</span>
      {issue.blocked && <StatusBadge label="Blocked" variant="danger" className="shrink-0" />}
    </button>
  );
}
