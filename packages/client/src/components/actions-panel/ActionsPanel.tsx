// T046: ActionsPanel collapsible component

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { RecommendedAction, AuthorStatus, ReviewerStatus } from "../../../../server/src/types/pr";

function getActionVariant(status: AuthorStatus | ReviewerStatus): "success" | "warning" | "danger" | "info" | "neutral" {
  switch (status) {
    case "Approved":
      return "success";
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

interface ActionsPanelProps {
  actions: RecommendedAction[];
}

const MAX_COLLAPSED = 3;

export function ActionsPanel({ actions }: ActionsPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  if (actions.length === 0) return null;

  const visibleActions = showAll ? actions : actions.slice(0, MAX_COLLAPSED);
  const hiddenCount = actions.length - MAX_COLLAPSED;

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
      {expanded && (
        <div className="border-t border-border px-4 py-2">
          <ul className="space-y-2">
            {visibleActions.map((action) => (
              <li key={action.prUrl} className="py-1">
                <div className="flex items-center gap-3">
                  <span className="shrink-0 text-xs font-medium text-foreground">
                    {action.action}
                  </span>
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
                <div className="flex items-center gap-3 ml-12 mt-0.5">
                  <a
                    href={action.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 truncate text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    #{action.prUrl.match(/\/pull\/(\d+)$/)?.[1] ?? ""}: {action.prTitle}
                  </a>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {action.repoName}
                  </span>
                </div>
                <div className="flex items-center gap-3 ml-12 mt-0.5">
                  <span className="shrink-0 text-sm"><span className="text-muted-foreground">Author:</span> {action.author}</span>
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
                              <img src={action.jiraPriority.iconUrl} alt={action.jiraPriority.name} className="h-3 w-3" />
                            )}
                            {action.jiraPriority.name}
                          </span>
                        )}
                        <a
                          href={action.jiraUrl!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {action.jiraTypeIconUrl && (
                            <img src={action.jiraTypeIconUrl} alt="" className="h-4 w-4" />
                          )}
                          {action.jiraKey}
                        </a>
                        {action.jiraSummary && (
                          <span className="text-xs text-muted-foreground">
                            {action.jiraSummary}
                          </span>
                        )}
                      </>
                    )}
                    {action.epicKey && (
                      <>
                        <a
                          href={`https://issues.redhat.com/browse/${action.epicKey}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          <span className="text-green-600 dark:text-green-400">⚡</span>
                          {action.epicKey}
                        </a>
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
            ))}
          </ul>
          {hiddenCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="mt-1 h-7 text-xs text-muted-foreground"
            >
              {showAll ? "Show less" : `Show ${hiddenCount} more`}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
