import {
  GitPullRequest,
  GitMerge,
  CircleDashed,
  AlertTriangle,
} from "lucide-react";
import type { JiraIssue } from "../../../../server/src/types/jira";
import type { JiraIssueRef, PullRequestRef } from "../../../../server/src/types/pr";
import { AppLink } from "../shared/AppLink";

type JiraData = JiraIssue | JiraIssueRef;

function isFullIssue(issue: JiraData): issue is JiraIssue {
  return "linkedPRs" in issue || "linkedPRUrls" in issue;
}

interface JiraDetailContentProps {
  issue: JiraData;
  isPartial: boolean;
  onNavigatePR: (url: string) => void;
}

export function JiraDetailContent({ issue, isPartial, onNavigatePR }: JiraDetailContentProps) {
  const full = isFullIssue(issue) ? issue : null;

  return (
    <div className="space-y-5">
      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Type:</span>
          {issue.typeIconUrl && <img src={issue.typeIconUrl} alt={issue.type} className="h-4 w-4" />}
          <span>{issue.type}</span>
        </div>
        <div>
          <span className="text-muted-foreground">State:</span>{" "}
          <span className="font-medium">{issue.state}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Priority:</span>
          {issue.priority.iconUrl && <img src={issue.priority.iconUrl} alt={issue.priority.name} className="h-4 w-4" />}
          <span>{issue.priority.name}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Assignee:</span>{" "}
          <span className="font-medium">{issue.assignee ?? "Unassigned"}</span>
        </div>
        {full?.storyPoints != null && (
          <div>
            <span className="text-muted-foreground">Story Points:</span>{" "}
            {full.storyPoints}
            {full.originalStoryPoints != null && full.originalStoryPoints !== full.storyPoints && (
              <span className="text-muted-foreground"> ({full.originalStoryPoints} original)</span>
            )}
          </div>
        )}
        {full?.sprintName && (
          <div>
            <span className="text-muted-foreground">Sprint:</span>{" "}
            {full.sprintName}
          </div>
        )}
      </div>

      {/* Summary */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground mb-1.5">Summary</h3>
        <p className="text-sm">{issue.summary}</p>
      </div>

      {/* Epic */}
      {issue.epicKey && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground mb-1.5">Epic</h3>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-600 dark:text-green-400">⚡</span>
            <AppLink
              href={`https://issues.redhat.com/browse/${issue.epicKey}`}
              epicKey={issue.epicKey}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {issue.epicKey}
            </AppLink>
            {issue.epicSummary && (
              <span className="text-muted-foreground">{issue.epicSummary}</span>
            )}
          </div>
        </div>
      )}

      {/* Blocked */}
      {issue.blocked && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
          <span className="text-sm font-medium text-red-800 dark:text-red-300">Blocked</span>
          {full?.blockedReason && (
            <span className="text-sm text-red-700 dark:text-red-400">— {full.blockedReason}</span>
          )}
        </div>
      )}

      {/* Linked PRs */}
      {full && full.linkedPRs && full.linkedPRs.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground mb-1.5">Linked Pull Requests</h3>
          <div className="space-y-1.5">
            {full.linkedPRs.map((pr) => (
              <PRRefRow key={pr.url} pr={pr} onClick={() => onNavigatePR(pr.url)} />
            ))}
          </div>
        </div>
      )}

      {/* Fallback: show PR URLs when we don't have full PR data */}
      {full && (!full.linkedPRs || full.linkedPRs.length === 0) && full.linkedPRUrls.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground mb-1.5">Linked Pull Requests</h3>
          <div className="space-y-1">
            {full.linkedPRUrls.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {url.split("/").pop()}
              </a>
            ))}
          </div>
        </div>
      )}

      {isPartial && (
        <p className="text-xs text-muted-foreground italic">
          Showing partial data from PR linkage. Open in Jira for full details.
        </p>
      )}
    </div>
  );
}

function PRRefRow({ pr, onClick }: { pr: PullRequestRef; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="cursor-pointer flex items-center gap-2 text-sm w-full text-left hover:bg-muted/50 rounded px-2 py-1 -mx-2 transition-colors"
    >
      <PRRefStateIcon pr={pr} />
      <span className="font-medium text-blue-600 dark:text-blue-400">#{pr.number}</span>
      <span className="truncate">{pr.title}</span>
      <span className="shrink-0 text-xs text-muted-foreground ml-auto">{pr.repoFullName}</span>
    </button>
  );
}

function PRRefStateIcon({ pr }: { pr: PullRequestRef }) {
  // PullRequestRef doesn't have state/isDraft, but reviewStatus has status
  const status = pr.reviewStatus.status;
  if (status === "Merged") return <GitMerge className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 shrink-0" />;
  if (status === "WIP") return <CircleDashed className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  return <GitPullRequest className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />;
}
