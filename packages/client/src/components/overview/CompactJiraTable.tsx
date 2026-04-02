// Compact Jira issue table for Overview cards

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReviewStatusCell } from "@/components/pr-table/ReviewStatusCell";
import { AppLink } from "@/components/shared/AppLink";
import { PRStateIcon, buildLinkedPRMap, type LinkedPR } from "@/components/jira-table/cells";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SortIcon, useSort, jiraPrioritySortValue, stateSortValue } from "./sort-utils";
import type { JiraIssue } from "../../../../server/src/types/jira";
import type { PullRequest } from "../../../../server/src/types/pr";

type JiraSortColumn = "type" | "key" | "summary" | "priority" | "assignee" | "status";

interface CompactJiraTableProps {
  issues: JiraIssue[];
  linkedPRs: PullRequest[];
  viewer: string;
  hideAssignee?: boolean;
  hideLinkedPRs?: boolean;
  hideStatus?: boolean;
  isPRsLoading?: boolean;
  maxItems?: number;
}

function CompactPRCell({ pr }: { pr: LinkedPR }) {
  const hasCIFailure = pr.checkState === "FAILURE" || pr.checkState === "ERROR";
  return (
    <div>
      <div className="flex items-center gap-1">
        <PRStateIcon pr={pr} />
        <AppLink
          href={pr.url}
          detail={{ type: "pr", url: pr.url }}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate"
        >
          #{pr.number} {pr.title}
        </AppLink>
      </div>
      <div className="ml-5 mt-1">
        <ReviewStatusCell result={pr.reviewStatus} hasCIFailure={hasCIFailure} inline />
      </div>
    </div>
  );
}

function CompactNoPRCell({ issue, isPRsLoading }: { issue: JiraIssue; isPRsLoading: boolean }) {
  if (issue.linkedPRUrls.length === 0) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }
  return (
    <div className="space-y-0.5">
      {issue.linkedPRUrls.map((url) => (
        <AppLink
          key={url}
          href={url}
          className="block text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {url.split("/").pop()}
        </AppLink>
      ))}
      {isPRsLoading && (
        <span className="text-xs text-muted-foreground animate-pulse">Loading...</span>
      )}
    </div>
  );
}

function sortJiraIssues(issues: JiraIssue[], column: JiraSortColumn, direction: "asc" | "desc"): JiraIssue[] {
  return [...issues].sort((a, b) => {
    let cmp = 0;
    switch (column) {
      case "type":
        cmp = a.type.localeCompare(b.type);
        break;
      case "key":
        cmp = a.key.localeCompare(b.key);
        break;
      case "summary":
        cmp = a.summary.localeCompare(b.summary);
        break;
      case "priority":
        cmp = jiraPrioritySortValue(a.priority.name) - jiraPrioritySortValue(b.priority.name);
        break;
      case "assignee":
        cmp = (a.assignee ?? "zzz").localeCompare(b.assignee ?? "zzz");
        break;
      case "status":
        cmp = stateSortValue(a.state) - stateSortValue(b.state);
        break;
    }
    return direction === "desc" ? -cmp : cmp;
  });
}

export function CompactJiraTable({
  issues,
  linkedPRs,
  viewer,
  hideAssignee,
  hideLinkedPRs,
  hideStatus,
  isPRsLoading = false,
  maxItems = 10,
}: CompactJiraTableProps) {
  const [expanded, setExpanded] = useState(false);
  const { sortColumn, sortDirection, handleSort } = useSort<JiraSortColumn>("priority", "desc");

  const sortedIssues = useMemo(
    () => sortJiraIssues(issues, sortColumn, sortDirection),
    [issues, sortColumn, sortDirection],
  );

  const hasMore = sortedIssues.length > maxItems;
  const visibleIssues = expanded ? sortedIssues : sortedIssues.slice(0, maxItems);

  const prsByIssueKey = useMemo(
    () => buildLinkedPRMap(issues, linkedPRs, viewer),
    [issues, linkedPRs, viewer],
  );

  const sortProps = { sortColumn, sortDirection };

  return (
    <div className="overflow-hidden">
      <Table className="border-separate border-spacing-0 w-full table-fixed">
        <TableHeader>
          <TableRow className="border-none hover:bg-transparent">
            <TableHead className="border-none text-xs cursor-pointer select-none whitespace-nowrap w-[32px]" onClick={() => handleSort("type")}>
              <span className="inline-flex items-center gap-1"><SortIcon column="type" {...sortProps} /></span>
            </TableHead>
            <TableHead className="border-none text-xs cursor-pointer select-none" onClick={() => handleSort("key")}>
              <span className="inline-flex items-center gap-1">Summary <SortIcon column="key" {...sortProps} /></span>
            </TableHead>
            <TableHead className="border-none text-xs cursor-pointer select-none whitespace-nowrap w-[32px]" onClick={() => handleSort("priority")}>
              <span className="inline-flex items-center gap-1">P <SortIcon column="priority" {...sortProps} /></span>
            </TableHead>
            {!hideAssignee && (
              <TableHead className="border-none text-xs cursor-pointer select-none whitespace-nowrap w-[120px]" onClick={() => handleSort("assignee")}>
                <span className="inline-flex items-center gap-1">Assignee <SortIcon column="assignee" {...sortProps} /></span>
              </TableHead>
            )}
            {!hideStatus && (
              <TableHead className="border-none text-xs cursor-pointer select-none whitespace-nowrap w-[90px]" onClick={() => handleSort("status")}>
                <span className="inline-flex items-center gap-1">Status <SortIcon column="status" {...sortProps} /></span>
              </TableHead>
            )}
            {!hideLinkedPRs && <TableHead className="border-none text-xs whitespace-nowrap">Linked PRs</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleIssues.map((issue) => {
            const issuePRs = prsByIssueKey.get(issue.key) ?? [];
            const rowCount = Math.max(issuePRs.length, 1);

            return (
              <IssueRows
                key={issue.key}
                issue={issue}
                linkedPRs={issuePRs}
                rowCount={rowCount}
                hideAssignee={hideAssignee}
                hideLinkedPRs={hideLinkedPRs}
                hideStatus={hideStatus}
                isPRsLoading={isPRsLoading}
              />
            );
          })}
        </TableBody>
      </Table>
      {!expanded && hasMore && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(true)}
          className="mt-1 h-7 text-xs text-muted-foreground"
        >
          Show {sortedIssues.length - maxItems} more
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

function IssueRows({
  issue,
  linkedPRs,
  rowCount,
  hideAssignee,
  hideLinkedPRs,
  hideStatus,
  isPRsLoading,
}: {
  issue: JiraIssue;
  linkedPRs: LinkedPR[];
  rowCount: number;
  hideAssignee?: boolean;
  hideLinkedPRs?: boolean;
  hideStatus?: boolean;
  isPRsLoading: boolean;
}) {
  return (
    <>
      <TableRow className="hover:bg-muted/50">
        <TableCell rowSpan={rowCount} className="py-1.5">
          <div className="flex items-center gap-1 text-xs">
            {issue.typeIconUrl && (
              <img src={issue.typeIconUrl} alt={issue.type} className="h-3.5 w-3.5" />
            )}
          </div>
        </TableCell>
        <TableCell rowSpan={rowCount} className="py-1.5 text-sm">
          <div>
            <AppLink
              href={issue.url}
              detail={{ type: "jira", key: issue.key }}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              {issue.key}
            </AppLink>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="truncate text-muted-foreground">
                  {issue.blocked && (
                    <StatusBadge label="Blocked" variant="danger" className="mr-1" />
                  )}
                  {issue.summary}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">{issue.summary}</TooltipContent>
            </Tooltip>
          </div>
        </TableCell>
        <TableCell rowSpan={rowCount} className="py-1.5">
          <div className="flex items-center gap-1 text-xs">
            {issue.priority.iconUrl && (
              <img src={issue.priority.iconUrl} alt="" className="h-3.5 w-3.5" />
            )}
          </div>
        </TableCell>
        {!hideAssignee && (
          <TableCell rowSpan={rowCount} className="py-1.5 text-xs truncate">
            {issue.assignee ?? "-"}
          </TableCell>
        )}
        {!hideStatus && (
          <TableCell rowSpan={rowCount} className="py-1.5 text-xs whitespace-nowrap">
            {issue.state}
          </TableCell>
        )}
        {/* First PR row or no-PR placeholder */}
        {!hideLinkedPRs && (
          <TableCell className="py-1.5">
            {linkedPRs.length > 0 ? (
              <CompactPRCell pr={linkedPRs[0]} />
            ) : (
              <CompactNoPRCell issue={issue} isPRsLoading={isPRsLoading} />
            )}
          </TableCell>
        )}
      </TableRow>
      {!hideLinkedPRs && linkedPRs.slice(1).map((pr) => (
        <TableRow key={pr.url} className="hover:bg-muted/50">
          <TableCell className="py-1.5">
            <CompactPRCell pr={pr} />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
