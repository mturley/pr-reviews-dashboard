import {
  GitPullRequest,
  GitMerge,
  CircleDot,
  CircleDashed,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type { JiraIssue } from "../../../../server/src/types/jira";
import type { JiraIssueRef } from "../../../../server/src/types/pr";
import type { PullRequest } from "../../../../server/src/types/pr";
import { AppLink } from "../shared/AppLink";
import { JiraMarkupInline } from "../shared/JiraMarkup";
import { formatUsername } from "@/lib/bot-users";
import { JiraIssueExtras } from "./JiraIssueExtras";

type JiraData = JiraIssue | JiraIssueRef;

function isFullIssue(issue: JiraData): issue is JiraIssue {
  return "linkedPRs" in issue || "linkedPRUrls" in issue;
}

function formatAge(dateStr: string): string {
  const now = Date.now();
  const created = new Date(dateStr).getTime();
  const diffMs = now - created;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

interface JiraDetailContentProps {
  issue: JiraData;
  isPartial: boolean;
  isLoading?: boolean;
  resolvedPRs?: PullRequest[];
  onNavigatePR: (url: string) => void;
}

export function JiraDetailContent({ issue, isPartial, isLoading, resolvedPRs, onNavigatePR }: JiraDetailContentProps) {
  const full = isFullIssue(issue) ? issue : null;

  return (
    <div className="space-y-5">
      {/* Summary — shown first */}
      <div>
        <p className="text-sm">{issue.summary}</p>
      </div>

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
        {full?.reporter && (
          <div>
            <span className="text-muted-foreground">Reporter:</span>{" "}
            {full.reporter}
          </div>
        )}
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
        {full?.activityType && (
          <div>
            <span className="text-muted-foreground">Activity Type:</span>{" "}
            {full.activityType}
          </div>
        )}
        {full?.createdAt && (
          <div>
            <span className="text-muted-foreground">Created:</span>{" "}
            {formatAge(full.createdAt)}
          </div>
        )}
        {full?.updatedAt && (
          <div>
            <span className="text-muted-foreground">Updated:</span>{" "}
            {formatAge(full.updatedAt)}
          </div>
        )}
      </div>

      {/* Labels */}
      {full?.labels && full.labels.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground">Labels:</span>
          {full.labels.map((label) => (
            <span key={label} className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
              {label}
            </span>
          ))}
        </div>
      )}

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
        <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <span className="text-sm font-medium text-red-800 dark:text-red-300">Blocked</span>
          {full?.blockedReason && (
            <span className="text-sm text-red-700 dark:text-red-400">
              — <JiraMarkupInline text={full.blockedReason} />
            </span>
          )}
        </div>
      )}

      {/* Linked PRs — enriched display from resolved full PullRequest objects */}
      {resolvedPRs && resolvedPRs.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground mb-1.5">Linked Pull Requests</h3>
          <div className="space-y-1.5">
            {resolvedPRs.map((pr) => (
              <EnrichedPRRow key={pr.url} pr={pr} onClick={() => onNavigatePR(pr.url)} />
            ))}
          </div>
        </div>
      )}

      {/* Fallback: show PR URLs when we don't have resolved PR data */}
      {(!resolvedPRs || resolvedPRs.length === 0) && full && full.linkedPRUrls.length > 0 && (
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

      {/* Description and Comments — lazy loaded */}
      {full && !isPartial && (
        <JiraIssueExtras
          issueKey={full.key}
          description={full.description}
        />
      )}

      {isPartial && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground italic">
          {isLoading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading full details...
            </>
          ) : (
            "Showing partial data from PR linkage. Open on Jira for full details."
          )}
        </p>
      )}
    </div>
  );
}

function PRStateIcon({ state, isDraft }: { state: string; isDraft: boolean }) {
  if (state === "MERGED") return <GitMerge className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 shrink-0" />;
  if (state === "CLOSED") return <CircleDot className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />;
  if (isDraft) return <CircleDashed className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  return <GitPullRequest className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />;
}

function stateLabel(state: string, isDraft: boolean): string {
  if (state === "MERGED") return "Merged";
  if (state === "CLOSED") return "Closed";
  if (isDraft) return "Draft";
  return "Open";
}

function EnrichedPRRow({ pr, onClick }: { pr: PullRequest; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="cursor-pointer flex items-center gap-2 text-sm w-full text-left hover:bg-muted/50 rounded px-2 py-1.5 -mx-2 transition-colors"
    >
      <PRStateIcon state={pr.state} isDraft={pr.isDraft} />
      <span className="font-medium text-blue-600 dark:text-blue-400 shrink-0">#{pr.number}</span>
      <span className="truncate flex-1">{pr.title}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{formatUsername(pr.author)}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{stateLabel(pr.state, pr.isDraft)}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{formatAge(pr.updatedAt)}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{pr.repoOwner}/{pr.repoName}</span>
    </button>
  );
}
