// T029: PR table column definitions with TanStack Table columnHelper

import { createColumnHelper } from "@tanstack/react-table";
import type { PullRequest } from "../../../../server/src/types/pr.js";
import type { ReviewStatusResult } from "../../../../server/src/types/pr.js";
import { ReviewStatusCell } from "./ReviewStatusCell";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { formatUsername } from "@/lib/bot-users";

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

// Jira priority IDs are numeric strings where lower = higher priority
// e.g. "1" = Blocker, "2" = Critical, "3" = Major, "4" = Normal, "5" = Minor
function jiraPrioritySortValue(row: PRRow): number {
  const id = row.pr.linkedJiraIssues[0]?.priority?.id;
  if (!id) return 999;
  return parseInt(id, 10) || 999;
}

// Review status sort: by priority field (lower = more urgent), null = least urgent
function reviewStatusSortValue(row: PRRow): number {
  return row.reviewStatus.priority ?? 999;
}

export const SORTABLE_COLUMNS = new Set(["action", "age", "updated", "reviewStatus", "jiraPriority", "jiraState"]);

export const columns = [
  columnHelper.accessor((row) => row.reviewStatus.priority ?? 999, {
    id: "action",
    header: "Action Needed",
    enableSorting: true,
    cell: (info) => {
      const action = info.row.original.reviewStatus.action;
      if (!action) return <span className="text-xs text-muted-foreground">-</span>;
      return <span className="text-xs font-medium">{action}</span>;
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
          <a
            href={pr.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            {pr.isDraft && <span className="text-muted-foreground">[Draft] </span>}
            #{pr.number}: {pr.title}
          </a>
          <div className="text-xs text-muted-foreground">
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
            <div key={issue.key}>
              <a
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {issue.typeIconUrl && (
                  <img src={issue.typeIconUrl} alt={issue.type} className="h-4 w-4" />
                )}
                {issue.key}
              </a>
              {issue.summary && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs text-muted-foreground truncate block max-w-[200px] cursor-default">{issue.summary}</span>
                  </TooltipTrigger>
                  <TooltipContent>{issue.summary}</TooltipContent>
                </Tooltip>
              )}
            </div>
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
        <div>
          <a
            href={`https://issues.redhat.com/browse/${epicKey}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span className="text-green-600 dark:text-green-400">⚡</span>
            {epicKey}
          </a>
          {epicSummary && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground truncate block max-w-[200px] cursor-default">{epicSummary}</span>
              </TooltipTrigger>
              <TooltipContent>{epicSummary}</TooltipContent>
            </Tooltip>
          )}
        </div>
      );
    },
  }),
];
