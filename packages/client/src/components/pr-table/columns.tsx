// T029: PR table column definitions with TanStack Table columnHelper

import { createColumnHelper } from "@tanstack/react-table";
import type { PullRequest } from "../../../../server/src/types/pr.js";
import type { ReviewStatusResult } from "../../../../server/src/types/pr.js";
import { ReviewStatusCell } from "./ReviewStatusCell";
import { StatusBadge } from "@/components/shared/StatusBadge";

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



export const columns = [
  columnHelper.accessor((row) => row.reviewStatus.action ?? "", {
    id: "action",
    header: "Action Needed",
    cell: (info) => {
      const action = info.row.original.reviewStatus.action;
      if (!action) return <span className="text-xs text-muted-foreground">-</span>;
      return <span className="text-xs font-medium">{action}</span>;
    },
  }),

  columnHelper.accessor((row) => row.pr.title, {
    id: "title",
    header: "PR",
    cell: (info) => {
      const pr = info.row.original.pr;
      return (
        <div className="max-w-md">
          <a
            href={pr.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            {pr.isDraft && <span className="text-muted-foreground">[Draft] </span>}
            {pr.title}
          </a>
          <div className="text-xs text-muted-foreground">
            {pr.repoOwner}/{pr.repoName} #{pr.number}
          </div>
        </div>
      );
    },
  }),

  columnHelper.accessor((row) => row.pr.author, {
    id: "author",
    header: "Author",
    cell: (info) => <span className="text-sm">{info.getValue()}</span>,
  }),

  columnHelper.accessor((row) => row.pr.createdAt, {
    id: "age",
    header: "Age",
    cell: (info) => (
      <span className="text-sm text-muted-foreground">
        {formatAge(info.getValue())}
      </span>
    ),
  }),

  columnHelper.accessor((row) => row.reviewStatus, {
    id: "reviewStatus",
    header: "Review Status",
    cell: (info) => {
      const row = info.row.original;
      const ciState = row.pr.checkStatus.state;
      const hasCIFailure = ciState === "FAILURE" || ciState === "ERROR";
      return <ReviewStatusCell result={info.getValue()} hasCIFailure={hasCIFailure} />;
    },
  }),

  // T039: Jira columns
  columnHelper.accessor((row) => row.pr.linkedJiraIssues[0]?.key ?? "", {
    id: "jiraKey",
    header: "Jira",
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
                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                {issue.typeIconUrl && (
                  <img src={issue.typeIconUrl} alt={issue.type} className="h-3 w-3" />
                )}
                {issue.key}
              </a>
              {issue.summary && (
                <span className="text-xs text-muted-foreground truncate block max-w-[200px]" title={issue.summary}>{issue.summary}</span>
              )}
            </div>
          ))}
        </div>
      );
    },
  }),

  columnHelper.accessor((row) => row.pr.linkedJiraIssues[0]?.priority?.name ?? "", {
    id: "jiraPriority",
    header: "Priority",
    cell: (info) => {
      const issues = info.row.original.pr.linkedJiraIssues;
      if (issues.length === 0) return <span className="text-xs text-muted-foreground">-</span>;
      const priority = issues[0].priority;
      return (
        <div className="flex items-center gap-1 text-xs">
          {priority.iconUrl && (
            <img src={priority.iconUrl} alt={priority.name} className="h-3 w-3" />
          )}
          {priority.name}
        </div>
      );
    },
  }),

  columnHelper.accessor((row) => row.pr.linkedJiraIssues[0]?.state ?? "", {
    id: "jiraState",
    header: "Jira Status",
    cell: (info) => {
      const issues = info.row.original.pr.linkedJiraIssues;
      if (issues.length === 0) return <span className="text-xs text-muted-foreground">-</span>;
      return <span className="text-xs">{issues[0].state}</span>;
    },
  }),

  columnHelper.accessor((row) => row.pr.linkedJiraIssues[0]?.assignee ?? "", {
    id: "jiraAssignee",
    header: "Assignee",
    cell: (info) => {
      const issues = info.row.original.pr.linkedJiraIssues;
      if (issues.length === 0) return <span className="text-xs text-muted-foreground">-</span>;
      return <span className="text-xs">{issues[0].assignee ?? "-"}</span>;
    },
  }),

  columnHelper.accessor((row) => row.pr.linkedJiraIssues[0]?.epicKey ?? "", {
    id: "jiraEpic",
    header: "Epic",
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
            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span className="text-green-600 dark:text-green-400">⚡</span>
            {epicKey}
          </a>
          {epicSummary && (
            <span className="text-xs text-muted-foreground truncate block max-w-[200px]" title={epicSummary}>{epicSummary}</span>
          )}
        </div>
      );
    },
  }),
];
