import { GitCommit } from "lucide-react";
import { StatusBadge, type StatusVariant } from "@/components/shared/StatusBadge";
import { formatUsername } from "@/lib/bot-users";
import type { ReviewerBreakdownEntry, CommitInfo, CommentAction } from "../../../../server/src/types/pr";

function formatReviewDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getEntryBadge(entry: ReviewerBreakdownEntry): { label: string; variant: StatusVariant } {
  if (entry.source === "comment") {
    switch (entry.commentAction as CommentAction) {
      case "LGTM":
        return { label: "/lgtm", variant: "success" };
      case "APPROVE":
        return { label: "/approve", variant: "success" };
      default:
        return { label: "Commented", variant: "neutral" };
    }
  }
  switch (entry.state) {
    case "APPROVED":
      return { label: "Approved", variant: "success" };
    case "CHANGES_REQUESTED":
      return { label: "Changes requested", variant: "danger" };
    case "COMMENTED":
      if (entry.commentAction === "LGTM") return { label: "/lgtm", variant: "success" };
      if (entry.commentAction === "APPROVE") return { label: "/approve", variant: "success" };
      return { label: "Commented", variant: "neutral" };
    case "DISMISSED":
      return { label: "Dismissed", variant: "neutral" };
    default:
      return { label: entry.state.replace(/_/g, " "), variant: "neutral" };
  }
}

interface CollapsedEntry {
  type: "entry";
  username: string;
  label: string;
  variant: StatusVariant;
  submittedAt: string | null;
  count: number;
}

interface PushDivider {
  type: "push";
  date: string;
  commits: CommitInfo[];
}

type TimelineItem = CollapsedEntry | PushDivider;

function buildExpandedTimeline(
  sorted: ReviewerBreakdownEntry[],
  pushDates: string[],
  commits: CommitInfo[],
): TimelineItem[] {
  // Group commits by pushedDate
  const commitsByDate = new Map<string, CommitInfo[]>();
  for (const commit of commits) {
    const existing = commitsByDate.get(commit.pushedDate) ?? [];
    existing.push(commit);
    commitsByDate.set(commit.pushedDate, existing);
  }

  const items: TimelineItem[] = [];
  let pushIdx = 0;

  for (const entry of sorted) {
    const entryTime = entry.submittedAt ?? "";

    // Insert push dividers that come before this entry
    while (pushIdx < pushDates.length && pushDates[pushIdx] <= entryTime) {
      const prev = items[items.length - 1];
      if (prev && prev.type === "push") {
        // Merge consecutive pushes
        const newCommits = commitsByDate.get(pushDates[pushIdx]) ?? [];
        prev.date = pushDates[pushIdx];
        prev.commits.push(...newCommits);
      } else {
        items.push({
          type: "push",
          date: pushDates[pushIdx],
          commits: [...(commitsByDate.get(pushDates[pushIdx]) ?? [])],
        });
      }
      pushIdx++;
    }

    // Collapse consecutive same-user/same-badge entries
    const badge = getEntryBadge(entry);
    const prev = items[items.length - 1];
    if (prev && prev.type === "entry" && prev.username === entry.username && prev.label === badge.label) {
      prev.count++;
      if (entry.submittedAt && (!prev.submittedAt || entry.submittedAt > prev.submittedAt)) {
        prev.submittedAt = entry.submittedAt;
      }
    } else {
      items.push({
        type: "entry",
        username: entry.username,
        label: badge.label,
        variant: badge.variant,
        submittedAt: entry.submittedAt,
        count: 1,
      });
    }
  }

  // Add remaining push dividers
  while (pushIdx < pushDates.length) {
    const prev = items[items.length - 1];
    if (prev && prev.type === "push") {
      const newCommits = commitsByDate.get(pushDates[pushIdx]) ?? [];
      prev.date = pushDates[pushIdx];
      prev.commits.push(...newCommits);
    } else {
      items.push({
        type: "push",
        date: pushDates[pushIdx],
        commits: [...(commitsByDate.get(pushDates[pushIdx]) ?? [])],
      });
    }
    pushIdx++;
  }

  return items;
}

interface ReviewHistoryProps {
  breakdown: ReviewerBreakdownEntry[];
  pushDates: string[];
  commits: CommitInfo[];
  repoOwner: string;
  repoName: string;
}

export function ReviewHistory({ breakdown, pushDates, commits, repoOwner, repoName }: ReviewHistoryProps) {
  const submitted = breakdown.filter((e) => e.state !== "PENDING");

  if (submitted.length === 0) {
    return <p className="text-xs text-muted-foreground">No review activity yet.</p>;
  }

  const sorted = [...submitted].sort((a, b) => {
    if (!a.submittedAt && !b.submittedAt) return 0;
    if (!a.submittedAt) return 1;
    if (!b.submittedAt) return -1;
    return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
  });

  const items = buildExpandedTimeline(sorted, pushDates, commits);

  // Determine stale boundary
  let lastPushIdx = -1;
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].type === "push") { lastPushIdx = i; break; }
  }

  return (
    <div className="space-y-1">
      {items.map((item, i) => {
        if (item.type === "push") {
          return (
            <div key={`push-${i}`} className="py-1.5">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 border-t border-dashed border-yellow-500/50" />
                <span className="text-[10px] text-yellow-500 font-medium whitespace-nowrap">
                  Commits pushed ({formatReviewDate(item.date)})
                </span>
                <div className="flex-1 border-t border-dashed border-yellow-500/50" />
              </div>
              {item.commits.length > 0 && (
                <div className="space-y-0.5 ml-1">
                  {item.commits.map((commit) => (
                    <div key={commit.oid} className="flex items-start gap-1.5 text-[11px]">
                      <GitCommit className="h-3 w-3 text-yellow-500/70 shrink-0 mt-0.5" />
                      <a
                        href={`https://github.com/${repoOwner}/${repoName}/commit/${commit.oid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-muted-foreground hover:text-foreground"
                      >
                        {commit.oid.slice(0, 7)}
                      </a>
                      <span className="text-muted-foreground truncate">{commit.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }
        const stale = lastPushIdx >= 0 && i < lastPushIdx;
        return (
          <div
            key={`${item.username}-${item.label}-${i}`}
            className={`flex items-center gap-2 text-xs whitespace-nowrap ${stale ? "opacity-50" : ""}`}
          >
            <span className="text-muted-foreground min-w-[70px]">
              {item.submittedAt ? formatReviewDate(item.submittedAt) : ""}
            </span>
            <span className="font-mono font-medium min-w-[100px]">{formatUsername(item.username)}</span>
            <StatusBadge label={item.label} variant={item.variant} />
            {item.count > 1 && (
              <span className="text-muted-foreground">&times;{item.count}</span>
            )}
          </div>
        );
      })}

    </div>
  );
}
