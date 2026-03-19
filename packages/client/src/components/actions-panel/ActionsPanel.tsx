// T046: ActionsPanel collapsible component

import { useState } from "react";
import { ChevronDown, ChevronRight, MessageSquareWarning, CircleX, Eye, GitMerge, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReviewBreakdownTooltip } from "@/components/shared/ReviewBreakdownTooltip";
import type { RecommendedAction, AuthorStatus, ReviewerStatus } from "../../../../server/src/types/pr";
import { formatUsername } from "@/lib/bot-users";
import { AppLink } from "@/components/shared/AppLink";
import { useJiraHost } from "@/hooks/useJiraHost";

function getActionVariant(status: AuthorStatus | ReviewerStatus): "success" | "warning" | "danger" | "info" | "neutral" | "purple" {
  switch (status) {
    case "Merged":
      return "purple";
    case "Approved":
      return "success";
    case "WIP":
    case "Team Re-review Needed":
    case "Needs Additional Review":
      return "warning";
    case "New Feedback":
    case "Needs First Review":
    case "I'm mentioned":
    case "My Re-review Needed":
      return "danger";
    case "Awaiting Changes":
      return "info";
    default:
      return "neutral";
  }
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) return "just now";
    if (diffHours === 1) return "1 hour ago";
    return `${diffHours} hours ago`;
  }
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

function ActionIcon({ action }: { action: string }) {
  const cls = "h-3.5 w-3.5 shrink-0";
  switch (action) {
    case "Address feedback":
      return <MessageSquareWarning className={`${cls} text-orange-500`} />;
    case "Fix CI errors":
      return <CircleX className={`${cls} text-red-500`} />;
    case "Re-review PR":
    case "Review PR":
      return <Eye className={`${cls} text-blue-500`} />;
    case "Merge PR":
      return <GitMerge className={`${cls} text-purple-500`} />;
    case "Complete work":
      return <PenLine className={`${cls} text-muted-foreground`} />;
    default:
      return null;
  }
}

function ActionItem({ action, jiraHost }: { action: RecommendedAction; jiraHost: string }) {
  return (
    <li className="py-1">
      <div className="flex items-center gap-3">
        <span className="shrink-0 flex items-center gap-1 text-xs font-medium text-foreground">
          <ActionIcon action={action.action} />
          {action.action}
        </span>
        <ReviewBreakdownTooltip breakdown={action.reviewerBreakdown} pushedAt={action.pushedAt} pushDates={action.pushDates}>
          <div className="flex items-center gap-2">
            <StatusBadge
              label={action.status}
              variant={getActionVariant(action.status)}
              className="shrink-0"
            />
            {action.hasCIFailure && (
              <StatusBadge label="CI Failed" variant="danger" className="shrink-0" />
            )}
            {action.parenthetical && (
              <span className="text-xs text-muted-foreground">{action.parenthetical}</span>
            )}
          </div>
        </ReviewBreakdownTooltip>
      </div>
      <div className="flex items-center gap-3 ml-12 mt-0.5">
        <AppLink
          href={action.prUrl}
          detail={{ type: "pr", url: action.prUrl }}
          className="min-w-0 truncate text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          #{action.prUrl.match(/\/pull\/(\d+)$/)?.[1] ?? ""}: {action.prTitle}
        </AppLink>
        <span className="shrink-0 text-xs text-muted-foreground">
          {action.repoName}
        </span>
      </div>
      <div className="flex items-center gap-3 ml-12 mt-0.5">
        <span className="shrink-0 text-sm"><span className="text-muted-foreground">Author:</span> {formatUsername(action.author)}</span>
        <span className="text-xs text-muted-foreground">
          Created: {formatRelativeTime(action.createdAt)}
        </span>
        <span className="text-xs text-muted-foreground">
          Updated: {formatRelativeTime(action.updatedAt)}
        </span>
      </div>
      {(action.jiraKey || action.epicKey) && (
        <div className="flex items-center gap-3 ml-12 mt-0.5">
          {action.jiraKey && (
            <>
              {action.jiraPriority && (
                <span className="shrink-0 flex items-center gap-1 text-xs">
                  {action.jiraPriority.iconUrl && (
                    <img src={action.jiraPriority.iconUrl} alt={action.jiraPriority.name} className="h-4 w-4" />
                  )}
                  {action.jiraPriority.name}
                </span>
              )}
              <AppLink
                href={action.jiraUrl!}
                detail={action.jiraKey ? { type: "jira", key: action.jiraKey } : undefined}
                className="shrink-0 flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {action.jiraTypeIconUrl && (
                  <img src={action.jiraTypeIconUrl} alt="" className="h-4 w-4" />
                )}
                {action.jiraKey}
              </AppLink>
              {action.jiraSummary && (
                <span className="text-xs text-muted-foreground">
                  {action.jiraSummary}
                </span>
              )}
            </>
          )}
          {action.epicKey && (
            <>
              <AppLink
                href={`https://${jiraHost}/browse/${action.epicKey}`}
                epicKey={action.epicKey}
                className="shrink-0 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                <span className="text-green-600 dark:text-green-400">⚡</span>
                {action.epicKey}
              </AppLink>
              {action.epicSummary && (
                <span className="text-xs text-muted-foreground">
                  {action.epicSummary}
                </span>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}

interface ActionsPanelProps {
  actions: RecommendedAction[];
  flat?: boolean;
  maxItems?: number;
}

const MAX_COLLAPSED = 1;

export function ActionsPanel({ actions, flat, maxItems }: ActionsPanelProps) {
  const jiraHost = useJiraHost();
  const [expanded, setExpanded] = useState(false);

  if (actions.length === 0) return null;

  const limit = flat ? (maxItems ?? actions.length) : MAX_COLLAPSED;
  const hasMore = actions.length > limit;
  const visibleActions = expanded ? actions : actions.slice(0, limit);

  if (flat) {
    return (
      <div>
        <ul className="space-y-2">
          {visibleActions.map((action) => (
            <ActionItem key={action.prUrl} action={action} jiraHost={jiraHost} />
          ))}
        </ul>
        {!expanded && hasMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(true)}
            className="mt-1 h-7 text-xs text-muted-foreground"
          >
            Show {actions.length - limit} more
          </Button>
        )}
        {expanded && hasMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(false)}
            className="mt-1 h-7 text-xs text-muted-foreground"
          >
            Show less
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <Button
        variant="ghost"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-start gap-2 px-4 py-3 text-left"
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="font-semibold">Recommended Actions</span>
        <span className="rounded-full bg-orange-100 dark:bg-orange-900/40 px-2 py-0.5 text-xs text-orange-800 dark:text-orange-300">
          {actions.length}
        </span>
      </Button>
      <div className="border-t border-border px-4 py-2">
        <ul className="space-y-2">
          {visibleActions.map((action) => (
            <ActionItem key={action.prUrl} action={action} jiraHost={jiraHost} />
          ))}
        </ul>
        {!expanded && hasMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(true)}
            className="mt-1 h-7 text-xs text-muted-foreground"
          >
            Show {actions.length - MAX_COLLAPSED} more
          </Button>
        )}
      </div>
    </div>
  );
}
