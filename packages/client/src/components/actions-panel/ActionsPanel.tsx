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
    case "New Feedback":
    case "My Re-review Needed":
    case "Needs First Review":
    case "Team Re-review Needed":
    case "Needs Additional Review":
      return "warning";
    case "Changes Requested (by others)":
    case "My Changes Requested":
      return "danger";
    default:
      return "neutral";
  }
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
        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800">
          {actions.length}
        </span>
      </Button>
      {expanded && (
        <div className="border-t border-border px-4 py-2">
          <ul className="space-y-2">
            {visibleActions.map((action) => (
              <li key={action.prUrl} className="flex items-center gap-3 py-1">
                <StatusBadge
                  label={action.status}
                  variant={getActionVariant(action.status)}
                  className="shrink-0"
                />
                <a
                  href={action.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-sm text-blue-600 hover:underline"
                >
                  {action.prTitle}
                </a>
                <span className="shrink-0 text-xs font-medium text-foreground">
                  {action.action}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {action.repoName}
                </span>
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
