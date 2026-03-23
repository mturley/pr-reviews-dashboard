// T029: PR table column definitions with TanStack Table columnHelper

import { createColumnHelper } from "@tanstack/react-table";
import { GitPullRequest, GitMerge, CircleDot, CircleDashed, MessageSquareWarning, CircleX, Eye, PenLine } from "lucide-react";
import type { PullRequest } from "../../../../server/src/types/pr.js";
import type { ReviewStatusResult } from "../../../../server/src/types/pr.js";
import { ReviewStatusCell } from "./ReviewStatusCell";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { formatUsername } from "@/lib/bot-users";
import { AppLink } from "@/components/shared/AppLink";

function PRStateIcon({ pr }: { pr: PullRequest }) {
  if (pr.state === "MERGED") return <GitMerge className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />;
  if (pr.state === "CLOSED") return <CircleDot className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />;
  if (pr.isDraft) return <CircleDashed className="h-4 w-4 text-muted-foreground shrink-0" />;
  return <GitPullRequest className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />;
}

export interface PRRow {
  pr: PullRequest;
  reviewStatus: ReviewStatusResult;
}

const columnHelper = createColumnHelper<PRRow>();

function formatAge(createdAt: string): string {
  const now = Date.now();
  const created = new Date(createdAt).getTime();
  const diffMs = now - created;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

// Jira priority: higher numeric value = more important, so descending = most important first
// Source IDs are inverted: "1" = Blocker (most important), so we negate.
function jiraPrioritySortValue(row: PRRow): number {
  const id = row.pr.linkedJiraIssues[0]?.priority?.id;
  if (!id) return -999;
  return -(parseInt(id, 10) || 999);
}

// Review status sort: by priority field (lower = more urgent), null = least urgent
function reviewStatusSortValue(row: PRRow): number {
  return row.reviewStatus.priority ?? 999;
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

export const SORTABLE_COLUMNS = new Set(["action", "age", "updated", "reviewStatus", "jiraPriority", "jiraState"]);

export function createColumns(jiraHost: string) {
return [
  columnHelper.accessor((row) => row.reviewStatus.priority ?? 999, {
    id: "action",
    header: "Action Needed",
    enableSorting: true,
    cell: (info) => {
      const action = info.row.original.reviewStatus.action;
      if (!action) return <span className="text-xs text-muted-foreground">-</span>;
      return (
        <span className="flex items-start gap-1 text-xs font-medium">
          <ActionIcon action={action} />
          {action}
        </span>
      );
    },
  }),

  columnHelper.accessor((row) => row.pr.title, {
    id: "title",
    header: "PR",
    enableSorting: false,
    cell: (info) => {
      const pr = info.row.original.pr;
      return (
        <div>
          <div className="flex items-center gap-1">
            <PRStateIcon pr={pr} />
            <AppLink
              href={pr.url}
              detail={{ type: "pr", url: pr.url }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              #{pr.number}: {pr.title}
            </AppLink>
          </div>
          <div className="text-xs text-muted-foreground ml-5">
            {pr.repoOwner}/{pr.repoName}
          </div>
        </div>
      );
    },
  }),

  columnHelper.accessor((row) => row.pr.author, {
    id: "author",
    header: "Author",
    enableSorting: false,
    cell: (info) => <span className="text-sm">{formatUsername(info.getValue())}</span>,
  }),

  columnHelper.accessor((row) => row.pr.createdAt, {
    id: "age",
    header: "Created",
    enableSorting: true,
    cell: (info) => (
      <span className="text-sm text-muted-foreground">
        {formatAge(info.getValue())}
      </span>
    ),
  }),

  columnHelper.accessor((row) => row.pr.updatedAt, {
    id: "updated",
    header: "Updated",
    enableSorting: true,
    cell: (info) => (
      <span className="text-sm text-muted-foreground">
        {formatAge(info.getValue())}
      </span>
    ),
  }),

  columnHelper.accessor((row) => reviewStatusSortValue(row), {
    id: "reviewStatus",
    header: "Review Status",
    enableSorting: true,
    cell: (info) => {
      const row = info.row.original;
      const ciState = row.pr.checkStatus.state;
      const hasCIFailure = ciState === "FAILURE" || ciState === "ERROR";
      return <ReviewStatusCell result={row.reviewStatus} hasCIFailure={hasCIFailure} />;
    },
  }),

  // T039: Jira columns
  columnHelper.accessor((row) => row.pr.linkedJiraIssues[0]?.key ?? "", {
    id: "jiraKey",
    header: "Jira",
    enableSorting: false,
    cell: (info) => {
      const issues = info.row.original.pr.linkedJiraIssues;
      if (issues.length === 0) return <span className="text-xs text-muted-foreground">-</span>;
      const hasBlocked = issues.some((i) => i.blocked);
      return (
        <div className="space-y-0.5">
          {hasBlocked && (
            <StatusBadge label="Blocked" variant="danger" className="mb-0.5" />
          )}
          {issues.map((issue) => (
            <Tooltip key={issue.key}>
              <TooltipTrigger asChild>
                <div>
                  <AppLink
                    href={issue.url}
                    detail={{ type: "jira", key: issue.key }}
                    className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {issue.typeIconUrl && (
                      <img src={issue.typeIconUrl} alt={issue.type} className="h-4 w-4" />
                    )}
                    {issue.key}
                  </AppLink>
                  {issue.summary && (
                    <span className="text-xs text-muted-foreground truncate block max-w-[200px]">{issue.summary}</span>
                  )}
                </div>
              </TooltipTrigger>
              {issue.summary && (
                <TooltipContent side="bottom">{issue.summary}</TooltipContent>
              )}
            </Tooltip>
          ))}
        </div>
      );
    },
  }),

  columnHelper.accessor((row) => jiraPrioritySortValue(row), {
    id: "jiraPriority",
    header: "Priority",
    enableSorting: true,
    cell: (info) => {
      const issues = info.row.original.pr.linkedJiraIssues;
      if (issues.length === 0) return <span className="text-xs text-muted-foreground">-</span>;
      const priority = issues[0].priority;
      return (
        <div className="flex items-center gap-1 text-xs">
          {priority.iconUrl && (
            <img src={priority.iconUrl} alt={priority.name} className="h-4 w-4" />
          )}
          {priority.name}
        </div>
      );
    },
  }),

  columnHelper.accessor((row) => row.pr.linkedJiraIssues[0]?.state ?? "", {
    id: "jiraState",
    header: "Jira Status",
    enableSorting: true,
    cell: (info) => {
      const issues = info.row.original.pr.linkedJiraIssues;
      if (issues.length === 0) return <span className="text-xs text-muted-foreground">-</span>;
      return <span className="text-xs">{issues[0].state}</span>;
    },
  }),

  columnHelper.accessor((row) => row.pr.linkedJiraIssues[0]?.assignee ?? "", {
    id: "jiraAssignee",
    header: "Assignee",
    enableSorting: false,
    cell: (info) => {
      const issues = info.row.original.pr.linkedJiraIssues;
      if (issues.length === 0) return <span className="text-xs text-muted-foreground">-</span>;
      return <span className="text-xs">{issues[0].assignee ?? "-"}</span>;
    },
  }),

  columnHelper.accessor((row) => row.pr.linkedJiraIssues[0]?.epicKey ?? "", {
    id: "jiraEpic",
    header: "Epic",
    enableSorting: false,
    cell: (info) => {
      const issues = info.row.original.pr.linkedJiraIssues;
      if (issues.length === 0) return <span className="text-xs text-muted-foreground">-</span>;
      const epicKey = issues[0].epicKey;
      const epicSummary = issues[0].epicSummary;
      if (!epicKey) return <span className="text-xs text-muted-foreground">-</span>;
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <AppLink
                href={`https://${jiraHost}/browse/${epicKey}`}
                epicKey={epicKey}
                className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                <span className="text-green-600 dark:text-green-400">⚡</span>
                {epicKey}
              </AppLink>
              {epicSummary && (
                <span className="text-xs text-muted-foreground truncate block max-w-[200px]">{epicSummary}</span>
              )}
            </div>
          </TooltipTrigger>
          {epicSummary && (
            <TooltipContent side="bottom">{epicSummary}</TooltipContent>
          )}
        </Tooltip>
      );
    },
  }),
];
}
