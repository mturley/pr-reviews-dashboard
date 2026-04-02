// Compact PR table for Overview cards (My PRs, PRs I'm Reviewing)

import { useMemo, useState } from "react";
import {
  GitPullRequest,
  GitMerge,
  CircleDot,
  CircleDashed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReviewStatusCell } from "@/components/pr-table/ReviewStatusCell";
import { AppLink } from "@/components/shared/AppLink";
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
import { SortIcon, useSort, jiraPrioritySortValue } from "./sort-utils";
import type { PullRequest, ReviewStatusResult } from "../../../../server/src/types/pr";
import { formatUsername } from "@/lib/bot-users";

type PRSortColumn = "pr" | "author" | "reviewStatus" | "jira" | "priority";

function PRStateIcon({ pr }: { pr: PullRequest }) {
  if (pr.state === "MERGED") return <GitMerge className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 shrink-0" />;
  if (pr.state === "CLOSED") return <CircleDot className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />;
  if (pr.isDraft) return <CircleDashed className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  return <GitPullRequest className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />;
}

interface CompactPRTableProps {
  prs: PullRequest[];
  reviewStatuses: Map<string, ReviewStatusResult>;
  hideAuthor?: boolean;
  maxItems?: number;
}

function sortPRs(
  prs: PullRequest[],
  column: PRSortColumn,
  direction: "asc" | "desc",
  reviewStatuses: Map<string, ReviewStatusResult>,
): PullRequest[] {
  return [...prs].sort((a, b) => {
    let cmp = 0;
    switch (column) {
      case "pr":
        cmp = a.title.localeCompare(b.title);
        break;
      case "author":
        cmp = a.author.localeCompare(b.author);
        break;
      case "reviewStatus": {
        const aStatus = reviewStatuses.get(a.id)?.label ?? "zzz";
        const bStatus = reviewStatuses.get(b.id)?.label ?? "zzz";
        cmp = aStatus.localeCompare(bStatus);
        break;
      }
      case "jira": {
        const aKey = a.linkedJiraIssues[0]?.key ?? "zzz";
        const bKey = b.linkedJiraIssues[0]?.key ?? "zzz";
        cmp = aKey.localeCompare(bKey);
        break;
      }
      case "priority": {
        const aPri = a.linkedJiraIssues[0]
          ? jiraPrioritySortValue(a.linkedJiraIssues[0].priority.name)
          : 99;
        const bPri = b.linkedJiraIssues[0]
          ? jiraPrioritySortValue(b.linkedJiraIssues[0].priority.name)
          : 99;
        cmp = aPri - bPri;
        break;
      }
    }
    return direction === "desc" ? -cmp : cmp;
  });
}

export function CompactPRTable({ prs, reviewStatuses, hideAuthor, maxItems = 10 }: CompactPRTableProps) {
  const [expanded, setExpanded] = useState(false);
  const { sortColumn, sortDirection, handleSort } = useSort<PRSortColumn>("priority", "desc");

  const sortedPRs = useMemo(
    () => sortPRs(prs, sortColumn, sortDirection, reviewStatuses),
    [prs, sortColumn, sortDirection, reviewStatuses],
  );

  const hasMore = sortedPRs.length > maxItems;
  const visiblePRs = expanded ? sortedPRs : sortedPRs.slice(0, maxItems);

  const sortProps = { sortColumn, sortDirection };

  return (
    <div className="overflow-hidden">
      <Table className="border-separate border-spacing-0 w-full table-fixed">
        <TableHeader>
          <TableRow className="border-none hover:bg-transparent">
            <TableHead className="border-none text-xs cursor-pointer select-none" onClick={() => handleSort("reviewStatus")}>
              <span className="inline-flex items-center gap-1">PR <SortIcon column="reviewStatus" {...sortProps} /></span>
            </TableHead>
            {!hideAuthor && (
              <TableHead className="border-none text-xs cursor-pointer select-none whitespace-nowrap w-[100px]" onClick={() => handleSort("author")}>
                <span className="inline-flex items-center gap-1">Author <SortIcon column="author" {...sortProps} /></span>
              </TableHead>
            )}
            <TableHead className="border-none text-xs cursor-pointer select-none whitespace-nowrap w-[180px]" onClick={() => handleSort("jira")}>
              <span className="inline-flex items-center gap-1">Jira <SortIcon column="jira" {...sortProps} /></span>
            </TableHead>
            <TableHead className="border-none text-xs cursor-pointer select-none whitespace-nowrap w-[32px]" onClick={() => handleSort("priority")}>
              <span className="inline-flex items-center gap-1">P <SortIcon column="priority" {...sortProps} /></span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visiblePRs.map((pr) => {
          const reviewStatus = reviewStatuses.get(pr.id);
          const ciState = pr.checkStatus.state;
          const hasCIFailure = ciState === "FAILURE" || ciState === "ERROR";
          const issue = pr.linkedJiraIssues[0];
          const priority = issue?.priority;

          return (
            <TableRow key={pr.id} className="hover:bg-muted/50">
              <TableCell className="py-1.5">
                <div>
                  <div className="flex items-center gap-1">
                    <PRStateIcon pr={pr} />
                    <AppLink
                      href={pr.url}
                      detail={{ type: "pr", url: pr.url }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate"
                    >
                      #{pr.number}: {pr.title}
                    </AppLink>
                  </div>
                  <div className="text-xs text-muted-foreground ml-5">
                    {pr.repoOwner}/{pr.repoName}
                  </div>
                  <div className="ml-5 mt-1">
                    {reviewStatus ? (
                      <ReviewStatusCell result={reviewStatus} hasCIFailure={hasCIFailure} inline />
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </div>
                </div>
              </TableCell>
              {!hideAuthor && (
                <TableCell className="py-1.5 text-xs whitespace-nowrap">{formatUsername(pr.author)}</TableCell>
              )}
              <TableCell className="py-1.5 whitespace-nowrap">
                {issue ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <AppLink
                          href={issue.url}
                          detail={{ type: "jira", key: issue.key }}
                          className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {issue.typeIconUrl && (
                            <img src={issue.typeIconUrl} alt={issue.type} className="h-3.5 w-3.5" />
                          )}
                          {issue.key}
                        </AppLink>
                        {issue.summary && (
                          <span className="text-xs text-muted-foreground truncate block max-w-[150px]">{issue.summary}</span>
                        )}
                      </div>
                    </TooltipTrigger>
                    {issue.summary && (
                      <TooltipContent side="bottom">{issue.summary}</TooltipContent>
                    )}
                  </Tooltip>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="py-1.5">
                {priority ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-xs">
                        {priority.iconUrl && (
                          <img src={priority.iconUrl} alt={priority.name} className="h-3.5 w-3.5" />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{priority.name}</TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </TableCell>
            </TableRow>
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
          Show {sortedPRs.length - maxItems} more
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
