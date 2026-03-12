// Shared Jira issue table with sorting, grouping, PR state icons, and review status

import { Fragment, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  GitPullRequest,
  GitMerge,
  CircleDot,
  CircleDashed,
} from "lucide-react";
import { computeReviewStatus } from "../../../../server/src/logic/review-status";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReviewStatusCell } from "@/components/pr-table/ReviewStatusCell";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
// Select UI no longer needed for group-by (uses toggle buttons)
import type { JiraIssue } from "../../../../server/src/types/jira";
import type { PullRequest, ReviewStatusResult } from "../../../../server/src/types/pr";
import { AppLink } from "@/components/shared/AppLink";

// Cell-based card styling per group tbody (matches PRTable)
const groupCardStyles = [
  "[&_td]:bg-card [&_td]:border-border [&_td]:border-b",
  "[&_tr:first-child_td]:border-t",
  "[&_tr_td:first-child]:border-l [&_tr_td:last-child]:border-r",
  "[&_tr:first-child_td:first-child]:rounded-tl-lg [&_tr:first-child_td:last-child]:rounded-tr-lg",
  "[&_tr:last-child_td:first-child]:rounded-bl-lg [&_tr:last-child_td:last-child]:rounded-br-lg",
  "[&_tr:last-child_td]:border-b",
  "[&_tr:hover_td]:bg-muted/50",
].join(" ");

// --- Types ---

export type SortColumn = "type" | "state" | "priority" | "assignee" | "sp";
type SortDirection = "asc" | "desc";
export type GroupBy = "state" | "assignee" | "priority" | "type";

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

// --- Sort / Group helpers ---

const JIRA_PRIORITY_ORDER: Record<string, number> = {
  blocker: 0, critical: 1, major: 2, normal: 3, minor: 4,
};

// State ordering: actionable states first
const JIRA_STATE_ORDER: Record<string, number> = {
  review: 0, "code review": 0,
  testing: 1, "in testing": 1,
  "in progress": 2,
  backlog: 3,
  new: 4,
  closed: 5, resolved: 5, done: 5,
};

function stateSortValue(state: string): number {
  return JIRA_STATE_ORDER[state.toLowerCase()] ?? 3;
}

function prioritySortValue(issue: JiraIssue): number {
  return JIRA_PRIORITY_ORDER[issue.priority.name.toLowerCase()] ?? 5;
}

function spSortValue(issue: JiraIssue): number {
  return issue.storyPoints ?? issue.originalStoryPoints ?? 999;
}

function sortIssues(issues: JiraIssue[], column: SortColumn, direction: SortDirection): JiraIssue[] {
  return [...issues].sort((a, b) => {
    let cmp = 0;
    switch (column) {
      case "type":
        cmp = a.type.localeCompare(b.type);
        break;
      case "state":
        cmp = stateSortValue(a.state) - stateSortValue(b.state);
        break;
      case "priority":
        cmp = prioritySortValue(a) - prioritySortValue(b);
        break;
      case "assignee":
        cmp = (a.assignee ?? "zzz").localeCompare(b.assignee ?? "zzz");
        break;
      case "sp":
        cmp = spSortValue(a) - spSortValue(b);
        break;
    }
    return direction === "desc" ? -cmp : cmp;
  });
}

function groupIssues(
  issues: JiraIssue[],
  groupBy: GroupBy,
  sortColumn: SortColumn,
  sortDirection: SortDirection,
): [string, JiraIssue[]][] {
  const groups = new Map<string, JiraIssue[]>();
  for (const issue of issues) {
    let key: string;
    switch (groupBy) {
      case "state":
        key = issue.state;
        break;
      case "assignee":
        key = issue.assignee ?? "Unassigned";
        break;
      case "priority":
        key = issue.priority.name;
        break;
      case "type":
        key = issue.type;
        break;
    }
    const list = groups.get(key) ?? [];
    list.push(issue);
    groups.set(key, list);
  }

  // When sorting by the same dimension as group-by, use that sort direction for group order
  const dir = sortColumn === groupBy && sortDirection === "desc" ? -1 : 1;

  if (groupBy === "priority") {
    return [...groups.entries()].sort(([a], [b]) =>
      dir * ((JIRA_PRIORITY_ORDER[a.toLowerCase()] ?? 5) - (JIRA_PRIORITY_ORDER[b.toLowerCase()] ?? 5)),
    );
  }
  if (groupBy === "state") {
    return [...groups.entries()].sort(([a], [b]) => dir * (stateSortValue(a) - stateSortValue(b)));
  }
  return [...groups.entries()].sort(([a], [b]) => dir * a.localeCompare(b));
}

// --- Sub-components ---

function PRStateIcon({ pr }: { pr: LinkedPR }) {
  if (pr.state === "MERGED") return <GitMerge className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />;
  if (pr.state === "CLOSED") return <CircleDot className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />;
  if (pr.isDraft) return <CircleDashed className="h-3.5 w-3.5 text-muted-foreground" />;
  return <GitPullRequest className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />;
}

function SortIcon({ column, sortColumn, sortDirection }: {
  column: SortColumn;
  sortColumn: SortColumn;
  sortDirection: SortDirection;
}) {
  if (column !== sortColumn) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  return sortDirection === "asc"
    ? <ArrowUp className="h-3 w-3" />
    : <ArrowDown className="h-3 w-3" />;
}

function PRLinkCell({ pr }: { pr: LinkedPR }) {
  return (
    <div>
      <div className="flex items-center gap-1">
        <PRStateIcon pr={pr} />
        <AppLink
          href={pr.url}
          detail={{ type: "pr", url: pr.url }}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline shrink-0"
        >
          #{pr.number}
        </AppLink>
        <span className="text-xs truncate max-w-[200px]">{pr.title}</span>
      </div>
      <span className="text-xs text-muted-foreground">{pr.repoOwner}/{pr.repoName}</span>
    </div>
  );
}

function IssueCells({
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
        <AppLink
          href={issue.url}
          detail={{ type: "jira", key: issue.key }}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {issue.key}
        </AppLink>
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

function PRCells({ pr, isSubRow }: { pr: LinkedPR; isSubRow?: boolean }) {
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

function NoPRCells({ issue, isPRsLoading }: { issue: JiraIssue; isPRsLoading: boolean }) {
  return (
    <>
      <TableCell>
        {issue.linkedPRUrls.length === 0 ? (
          <span className="text-xs text-muted-foreground">-</span>
        ) : (
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
        )}
      </TableCell>
      <TableCell>
        <span className="text-xs text-muted-foreground">-</span>
      </TableCell>
    </>
  );
}

function IssueRow({
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

function CollapsibleGroup({
  label,
  issues,
  prsByIssueKey,
  isPRsLoading,
}: {
  label: string;
  issues: JiraIssue[];
  prsByIssueKey: Map<string, LinkedPR[]>;
  isPRsLoading: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const colCount = 9;

  return (
    <TableBody className={groupCardStyles}>
      <TableRow
        className="cursor-pointer hover:!bg-transparent"
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell colSpan={colCount} className="py-2.5 px-3 !bg-muted/40 hover:!bg-muted/60">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-semibold">{label}</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {issues.length}
            </span>
          </div>
        </TableCell>
      </TableRow>
      {expanded &&
        issues.map((issue) => {
          const linkedPRs = prsByIssueKey.get(issue.key) ?? [];
          return (
            <IssueRow
              key={issue.key}
              issue={issue}
              linkedPRs={linkedPRs}
              isPRsLoading={isPRsLoading}
            />
          );
        })}
    </TableBody>
  );
}

// --- Subtask detection ---

const SUBTASK_TYPES = new Set(["sub-task", "subtask", "sub task"]);

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

// --- Main component ---

export interface JiraIssueTableProps {
  issues: JiraIssue[];
  linkedPRs: PullRequest[];
  isPRsLoading: boolean;
  viewer: string;
  showSubtaskToggle?: boolean;
}

export function JiraIssueTable({
  issues,
  linkedPRs,
  isPRsLoading,
  viewer,
  showSubtaskToggle = true,
}: JiraIssueTableProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>("state");
  const [excludeSubtasks, setExcludeSubtasks] = useState(true);
  const [sortColumn, setSortColumn] = useState<SortColumn>("priority");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const prsByIssueKey = useMemo(
    () => buildLinkedPRMap(issues, linkedPRs, viewer),
    [issues, linkedPRs, viewer],
  );

  const filteredIssues = useMemo(() => {
    if (!excludeSubtasks || !showSubtaskToggle) return issues;
    return issues.filter((i) => !SUBTASK_TYPES.has(i.type.toLowerCase()));
  }, [issues, excludeSubtasks, showSubtaskToggle]);

  const grouped = useMemo(() => {
    const groups = groupIssues(filteredIssues, groupBy, sortColumn, sortDirection);
    return groups.map(([label, groupIssues]) =>
      [label, sortIssues(groupIssues, sortColumn, sortDirection)] as const,
    );
  }, [filteredIssues, groupBy, sortColumn, sortDirection]);

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Group by:</span>
          <div className="flex rounded-md border border-border overflow-hidden">
            {([
              { value: "state" as const, label: "Jira Status" },
              { value: "assignee" as const, label: "Assignee" },
              { value: "priority" as const, label: "Priority" },
              { value: "type" as const, label: "Type" },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setGroupBy(opt.value)}
                className={`cursor-pointer px-2.5 py-1 text-xs font-medium transition-colors border-r border-border last:border-r-0 ${
                  groupBy === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {showSubtaskToggle && (
          <div className="flex items-center gap-1.5">
            <Switch
              checked={excludeSubtasks}
              onCheckedChange={setExcludeSubtasks}
              aria-label="Exclude subtasks"
            />
            <span className="text-xs">Exclude subtasks</span>
          </div>
        )}
      </div>

      {grouped.length > 0 && (
        <Table className="border-separate border-spacing-0">
          <TableHeader>
            <TableRow className="border-none hover:bg-transparent">
              <TableHead
                className="border-none cursor-pointer select-none hover:text-foreground"
                onClick={() => handleSort("type")}
              >
                <div className="flex items-center gap-1">
                  Type <SortIcon column="type" sortColumn={sortColumn} sortDirection={sortDirection} />
                </div>
              </TableHead>
              <TableHead className="border-none">Key</TableHead>
              <TableHead className="border-none">Summary</TableHead>
              <TableHead
                className="border-none cursor-pointer select-none hover:text-foreground"
                onClick={() => handleSort("priority")}
              >
                <div className="flex items-center gap-1">
                  Priority <SortIcon column="priority" sortColumn={sortColumn} sortDirection={sortDirection} />
                </div>
              </TableHead>
              <TableHead
                className="border-none cursor-pointer select-none hover:text-foreground"
                onClick={() => handleSort("assignee")}
              >
                <div className="flex items-center gap-1">
                  Assignee <SortIcon column="assignee" sortColumn={sortColumn} sortDirection={sortDirection} />
                </div>
              </TableHead>
              <TableHead
                className="border-none cursor-pointer select-none hover:text-foreground"
                onClick={() => handleSort("sp")}
              >
                <div className="flex items-center gap-1">
                  SP <SortIcon column="sp" sortColumn={sortColumn} sortDirection={sortDirection} />
                </div>
              </TableHead>
              <TableHead
                className="border-none cursor-pointer select-none hover:text-foreground"
                onClick={() => handleSort("state")}
              >
                <div className="flex items-center gap-1">
                  Status <SortIcon column="state" sortColumn={sortColumn} sortDirection={sortDirection} />
                </div>
              </TableHead>
              <TableHead className="border-none">Linked PRs</TableHead>
              <TableHead className="border-none">Review Status</TableHead>
            </TableRow>
          </TableHeader>
          {grouped.map(([label, issues], index) => (
            <Fragment key={label}>
              {index > 0 && (
                <tbody aria-hidden>
                  <tr>
                    <td colSpan={99} className="h-6 p-0 border-none" />
                  </tr>
                </tbody>
              )}
              <CollapsibleGroup
                label={label}
                issues={issues}
                prsByIssueKey={prsByIssueKey}
                isPRsLoading={isPRsLoading}
              />
            </Fragment>
          ))}
        </Table>
      )}
    </>
  );
}
