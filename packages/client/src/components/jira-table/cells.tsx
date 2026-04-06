// Shared cell components for Jira issue tables (used by JiraIssueTable and Overview compact tables)

import {
  GitPullRequest,
  GitMerge,
  CircleDot,
  CircleDashed,
} from "lucide-react";
import { computeReviewStatus } from "../../../../server/src/logic/review-status";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReviewStatusCell } from "@/components/pr-table/ReviewStatusCell";
import {
  TableCell,
  TableRow,
} from "@/components/ui/table";
import type { JiraIssue } from "../../../../server/src/types/jira";
import type { PullRequest, ReviewStatusResult } from "../../../../server/src/types/pr";
import { AppLink } from "@/components/shared/AppLink";
import { CopyLinkButton } from "@/components/shared/CopyLinkButton";

// --- Types ---

export interface LinkedPR {
  url: string;
  number: number;
  title: string;
  repoOwner: string;
  repoName: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  isDraft: boolean;
  reviewStatus: ReviewStatusResult;
  checkState: string | null;
}

// --- Build linked PR data from fetched PullRequest objects ---

export function buildLinkedPRMap(
  issues: JiraIssue[],
  prs: PullRequest[],
  viewer: string,
): Map<string, LinkedPR[]> {
  const prByUrl = new Map<string, PullRequest>();
  for (const pr of prs) {
    prByUrl.set(pr.url.replace(/\/$/, ""), pr);
  }

  const map = new Map<string, LinkedPR[]>();
  for (const issue of issues) {
    const linked: LinkedPR[] = [];
    for (const url of issue.linkedPRUrls) {
      const pr = prByUrl.get(url.replace(/\/$/, ""));
      if (pr) {
        linked.push({
          url: pr.url,
          number: pr.number,
          title: pr.title,
          repoOwner: pr.repoOwner,
          repoName: pr.repoName,
          state: pr.state,
          isDraft: pr.isDraft,
          reviewStatus: computeReviewStatus(pr, viewer),
          checkState: pr.checkStatus.state,
        });
      }
    }
    if (linked.length > 0) {
      map.set(issue.key, linked);
    }
  }
  return map;
}

// --- Sub-components ---

export function PRStateIcon({ pr }: { pr: LinkedPR }) {
  if (pr.state === "MERGED") return <GitMerge className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />;
  if (pr.state === "CLOSED") return <CircleDot className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />;
  if (pr.isDraft) return <CircleDashed className="h-3.5 w-3.5 text-muted-foreground" />;
  return <GitPullRequest className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />;
}

export function PRLinkCell({ pr }: { pr: LinkedPR }) {
  return (
    <div>
      <div className="flex items-center gap-1 group/link">
        <PRStateIcon pr={pr} />
        <AppLink
          href={pr.url}
          detail={{ type: "pr", url: pr.url }}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[200px]"
        >
          #{pr.number} {pr.title}
        </AppLink>
        <CopyLinkButton url={pr.url} />
      </div>
      <span className="text-xs text-muted-foreground">{pr.repoOwner}/{pr.repoName}</span>
    </div>
  );
}

export function IssueCells({
  issue,
  rowSpan,
}: {
  issue: JiraIssue;
  rowSpan: number;
}) {
  return (
    <>
      <TableCell rowSpan={rowSpan}>
        <div className="flex items-center gap-1 text-xs">
          {issue.typeIconUrl && (
            <img src={issue.typeIconUrl} alt={issue.type} className="h-4 w-4" />
          )}
          {issue.type}
        </div>
      </TableCell>
      <TableCell rowSpan={rowSpan}>
        <div className="flex items-center gap-1 group/link">
          <AppLink
            href={issue.url}
            detail={{ type: "jira", key: issue.key }}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {issue.key}
          </AppLink>
          <CopyLinkButton url={issue.url} />
        </div>
      </TableCell>
      <TableCell rowSpan={rowSpan} className="max-w-md truncate text-sm">
        {issue.blocked && (
          <StatusBadge label="Blocked" variant="danger" className="mr-2" />
        )}
        {issue.summary}
      </TableCell>
      <TableCell rowSpan={rowSpan}>
        <div className="flex items-center gap-1 text-xs">
          {issue.priority.iconUrl && (
            <img src={issue.priority.iconUrl} alt="" className="h-4 w-4" />
          )}
          {issue.priority.name}
        </div>
      </TableCell>
      <TableCell rowSpan={rowSpan} className="text-xs">{issue.assignee ?? "-"}</TableCell>
      <TableCell rowSpan={rowSpan} className="text-xs">
        {issue.storyPoints ?? "-"}
        {issue.originalStoryPoints != null &&
          issue.originalStoryPoints !== issue.storyPoints && (
            <span className="text-muted-foreground">
              {" "}
              ({issue.originalStoryPoints} original SP)
            </span>
          )}
      </TableCell>
      <TableCell rowSpan={rowSpan} className="text-xs">{issue.state}</TableCell>
    </>
  );
}

export function PRCells({ pr, isSubRow }: { pr: LinkedPR; isSubRow?: boolean }) {
  return (
    <>
      <TableCell className={isSubRow ? "!border-l-0" : ""}>
        <PRLinkCell pr={pr} />
      </TableCell>
      <TableCell>
        <ReviewStatusCell
          result={pr.reviewStatus}
          hasCIFailure={pr.checkState === "FAILURE" || pr.checkState === "ERROR"}
        />
      </TableCell>
    </>
  );
}

export function NoPRCells({ issue, isPRsLoading }: { issue: JiraIssue; isPRsLoading: boolean }) {
  return (
    <>
      <TableCell>
        {issue.linkedPRUrls.length === 0 ? (
          <span className="text-xs text-muted-foreground">-</span>
        ) : (
          <div className="space-y-0.5">
            {issue.linkedPRUrls.map((url) => (
              <div key={url} className="flex items-center gap-1 group/link">
                <AppLink
                  href={url}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {url.split("/").pop()}
                </AppLink>
                <CopyLinkButton url={url} />
              </div>
            ))}
            {isPRsLoading && (
              <span className="text-xs text-muted-foreground animate-pulse">Loading...</span>
            )}
          </div>
        )}
      </TableCell>
      <TableCell>
        <span className="text-xs text-muted-foreground">-</span>
      </TableCell>
    </>
  );
}

export function IssueRow({
  issue,
  linkedPRs,
  isPRsLoading,
}: {
  issue: JiraIssue;
  linkedPRs: LinkedPR[];
  isPRsLoading: boolean;
}) {
  const rowCount = Math.max(linkedPRs.length, 1);

  return (
    <>
      <TableRow>
        <IssueCells issue={issue} rowSpan={rowCount} />
        {linkedPRs.length === 0 ? (
          <NoPRCells issue={issue} isPRsLoading={isPRsLoading} />
        ) : (
          <PRCells pr={linkedPRs[0]} />
        )}
      </TableRow>
      {linkedPRs.slice(1).map((pr) => (
        <TableRow key={pr.url}>
          <PRCells pr={pr} isSubRow />
        </TableRow>
      ))}
    </>
  );
}
