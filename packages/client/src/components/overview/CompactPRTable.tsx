// Compact PR table for Overview cards (My PRs, PRs I'm Reviewing)

import { useState } from "react";
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
import type { PullRequest, ReviewStatusResult } from "../../../../server/src/types/pr";
import { formatUsername } from "@/lib/bot-users";

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

export function CompactPRTable({ prs, reviewStatuses, hideAuthor, maxItems = 10 }: CompactPRTableProps) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = prs.length > maxItems;
  const visiblePRs = expanded ? prs : prs.slice(0, maxItems);

  return (
    <div>
      <Table className="border-separate border-spacing-0">
        <TableHeader>
          <TableRow className="border-none hover:bg-transparent">
            <TableHead className="border-none text-xs">PR</TableHead>
            {!hideAuthor && <TableHead className="border-none text-xs">Author</TableHead>}
            <TableHead className="border-none text-xs">Review Status</TableHead>
            <TableHead className="border-none text-xs">Jira</TableHead>
            <TableHead className="border-none text-xs">Priority</TableHead>
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
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[250px]"
                    >
                      #{pr.number}: {pr.title}
                    </AppLink>
                  </div>
                  <div className="text-xs text-muted-foreground ml-5">
                    {pr.repoOwner}/{pr.repoName}
                  </div>
                </div>
              </TableCell>
              {!hideAuthor && (
                <TableCell className="py-1.5 text-xs">{formatUsername(pr.author)}</TableCell>
              )}
              <TableCell className="py-1.5">
                {reviewStatus ? (
                  <ReviewStatusCell result={reviewStatus} hasCIFailure={hasCIFailure} />
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="py-1.5">
                {issue ? (
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
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="py-1.5">
                {priority ? (
                  <div className="flex items-center gap-1 text-xs">
                    {priority.iconUrl && (
                      <img src={priority.iconUrl} alt={priority.name} className="h-3.5 w-3.5" />
                    )}
                    {priority.name}
                  </div>
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
          Show {prs.length - maxItems} more
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
