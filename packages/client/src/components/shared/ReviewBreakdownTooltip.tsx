import type { ReviewerBreakdownEntry } from "../../../../server/src/types/pr.js";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatUsername } from "@/lib/bot-users";

type StatusVariant = "success" | "warning" | "danger" | "info" | "neutral";

function formatReviewDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getEntryBadge(entry: ReviewerBreakdownEntry): { label: string; variant: StatusVariant } {
  if (entry.source === "comment") {
    switch (entry.commentAction) {
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
  count: number;
}

type TimelineItem = CollapsedEntry | PushDivider;

function buildTimeline(
  sorted: ReviewerBreakdownEntry[],
  pushDates: string[],
): TimelineItem[] {
  const items: TimelineItem[] = [];
  let pushIdx = 0;

  for (const entry of sorted) {
    const entryTime = entry.submittedAt ?? "";

    // Insert any push dividers that come before this entry, collapsing consecutive ones
    while (pushIdx < pushDates.length && pushDates[pushIdx] <= entryTime) {
      const prev = items[items.length - 1];
      if (prev && prev.type === "push") {
        prev.date = pushDates[pushIdx];
        prev.count++;
      } else {
        items.push({ type: "push", date: pushDates[pushIdx], count: 1 });
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

  // Add any remaining push dividers after all entries, collapsing consecutive ones
  while (pushIdx < pushDates.length) {
    const prev = items[items.length - 1];
    if (prev && prev.type === "push") {
      prev.date = pushDates[pushIdx];
      prev.count++;
    } else {
      items.push({ type: "push", date: pushDates[pushIdx], count: 1 });
    }
    pushIdx++;
  }

  return items;
}

interface ReviewBreakdownTooltipProps {
  breakdown: ReviewerBreakdownEntry[];
  pushedAt?: string;
  pushDates?: string[];
  children: React.ReactNode;
}

export function ReviewBreakdownTooltip({ breakdown, pushedAt, pushDates, children }: ReviewBreakdownTooltipProps) {
  const submitted = breakdown.filter((e) => e.state !== "PENDING");
  if (submitted.length === 0) return <>{children}</>;

  const sorted = [...submitted].sort((a, b) => {
    if (!a.submittedAt && !b.submittedAt) return 0;
    if (!a.submittedAt) return 1;
    if (!b.submittedAt) return -1;
    return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
  });

  // Use pushDates if available, otherwise fall back to single pushedAt
  const dates = pushDates && pushDates.length > 0 ? pushDates : pushedAt ? [pushedAt] : [];
  const items = buildTimeline(sorted, dates);

  // Determine which entries are "stale" (before the last push divider)
  let lastPushIdx = -1;
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].type === "push") { lastPushIdx = i; break; }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help">{children}</div>
      </TooltipTrigger>
      <TooltipContent className="max-w-lg p-3 bg-popover text-popover-foreground border border-border shadow-lg">
        <div className="space-y-1">
          <p className="text-xs font-semibold mb-2">Review and change history</p>
          {items.map((item, i) => {
            if (item.type === "push") {
              return (
                <div key={`push-${i}`} className="flex items-center gap-2 py-1">
                  <div className="flex-1 border-t border-dashed border-yellow-500/50" />
                  <span className="text-[10px] text-yellow-500 font-medium whitespace-nowrap">
                    Commits pushed{item.count > 1 ? ` \u00d7${item.count}` : ""} ({formatReviewDate(item.date)})
                  </span>
                  <div className="flex-1 border-t border-dashed border-yellow-500/50" />
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
      </TooltipContent>
    </Tooltip>
  );
}
