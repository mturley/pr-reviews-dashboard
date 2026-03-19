// Compact Jira issue table for Overview cards

import { useMemo } from "react";
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
import type { JiraIssue } from "../../../../server/src/types/jira";
import type { PullRequest } from "../../../../server/src/types/pr";

interface CompactJiraTableProps {
  issues: JiraIssue[];
  linkedPRs: PullRequest[];
  viewer: string;
  hideAssignee?: boolean;
  isPRsLoading?: boolean;
}

function CompactPRCell({ pr }: { pr: LinkedPR }) {
  return (
    <div className="flex items-center gap-1">
      <PRStateIcon pr={pr} />
      <AppLink
        href={pr.url}
        detail={{ type: "pr", url: pr.url }}
        className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[150px]"
      >
        #{pr.number} {pr.title}
      </AppLink>
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

export function CompactJiraTable({
  issues,
  linkedPRs,
  viewer,
  hideAssignee,
  isPRsLoading = false,
}: CompactJiraTableProps) {
  const prsByIssueKey = useMemo(
    () => buildLinkedPRMap(issues, linkedPRs, viewer),
    [issues, linkedPRs, viewer],
  );

  return (
    <Table className="border-separate border-spacing-0">
      <TableHeader>
        <TableRow className="border-none hover:bg-transparent">
          <TableHead className="border-none text-xs">Type</TableHead>
          <TableHead className="border-none text-xs">Key</TableHead>
          <TableHead className="border-none text-xs">Summary</TableHead>
          <TableHead className="border-none text-xs">Priority</TableHead>
          {!hideAssignee && <TableHead className="border-none text-xs">Assignee</TableHead>}
          <TableHead className="border-none text-xs">Status</TableHead>
          <TableHead className="border-none text-xs">Linked PRs</TableHead>
          <TableHead className="border-none text-xs">Review Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.map((issue) => {
          const issuePRs = prsByIssueKey.get(issue.key) ?? [];
          const rowCount = Math.max(issuePRs.length, 1);

          return (
            <IssueRows
              key={issue.key}
              issue={issue}
              linkedPRs={issuePRs}
              rowCount={rowCount}
              hideAssignee={hideAssignee}
              isPRsLoading={isPRsLoading}
            />
          );
        })}
      </TableBody>
    </Table>
  );
}

function IssueRows({
  issue,
  linkedPRs,
  rowCount,
  hideAssignee,
  isPRsLoading,
}: {
  issue: JiraIssue;
  linkedPRs: LinkedPR[];
  rowCount: number;
  hideAssignee?: boolean;
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
        <TableCell rowSpan={rowCount} className="py-1.5">
          <AppLink
            href={issue.url}
            detail={{ type: "jira", key: issue.key }}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
          >
            {issue.key}
          </AppLink>
        </TableCell>
        <TableCell rowSpan={rowCount} className="py-1.5 max-w-[200px] truncate text-xs">
          {issue.blocked && (
            <StatusBadge label="Blocked" variant="danger" className="mr-1" />
          )}
          {issue.summary}
        </TableCell>
        <TableCell rowSpan={rowCount} className="py-1.5">
          <div className="flex items-center gap-1 text-xs">
            {issue.priority.iconUrl && (
              <img src={issue.priority.iconUrl} alt="" className="h-3.5 w-3.5" />
            )}
          </div>
        </TableCell>
        {!hideAssignee && (
          <TableCell rowSpan={rowCount} className="py-1.5 text-xs">
            {issue.assignee ?? "-"}
          </TableCell>
        )}
        <TableCell rowSpan={rowCount} className="py-1.5 text-xs">
          {issue.state}
        </TableCell>
        {/* First PR row or no-PR placeholder */}
        <TableCell className="py-1.5">
          {linkedPRs.length > 0 ? (
            <CompactPRCell pr={linkedPRs[0]} />
          ) : (
            <CompactNoPRCell issue={issue} isPRsLoading={isPRsLoading} />
          )}
        </TableCell>
        <TableCell className="py-1.5">
          {linkedPRs.length > 0 ? (
            <ReviewStatusCell
              result={linkedPRs[0].reviewStatus}
              hasCIFailure={linkedPRs[0].checkState === "FAILURE" || linkedPRs[0].checkState === "ERROR"}
            />
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </TableCell>
      </TableRow>
      {linkedPRs.slice(1).map((pr) => (
        <TableRow key={pr.url} className="hover:bg-muted/50">
          <TableCell className="py-1.5">
            <CompactPRCell pr={pr} />
          </TableCell>
          <TableCell className="py-1.5">
            <ReviewStatusCell
              result={pr.reviewStatus}
              hasCIFailure={pr.checkState === "FAILURE" || pr.checkState === "ERROR"}
            />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
