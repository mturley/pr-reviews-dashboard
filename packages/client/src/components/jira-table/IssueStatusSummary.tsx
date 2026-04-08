// Summary card showing issue counts by status

import { useMemo } from "react";
import type { JiraIssue } from "../../../../server/src/types/jira";
import { groupAnchorId } from "./JiraIssueTable";

interface IssueStatusSummaryProps {
  issues: JiraIssue[];
  onStatusClick?: (label: string) => void;
}

// Map Jira status names to colors for the number and badge
function getStatusColors(status: string): { number: string; badge: string } {
  const s = status.toLowerCase();
  if (["done", "closed", "resolved"].includes(s))
    return {
      number: "text-green-600 dark:text-green-400",
      badge: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800",
    };
  if (s === "in progress" || s === "in development")
    return {
      number: "text-blue-600 dark:text-blue-400",
      badge: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
    };
  if (s === "review" || s === "code review" || s === "in review" || s === "peer review")
    return {
      number: "text-purple-600 dark:text-purple-400",
      badge: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800",
    };
  if (s === "testing" || s === "qa" || s === "in testing" || s === "ready for testing")
    return {
      number: "text-yellow-600 dark:text-yellow-400",
      badge: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800",
    };
  if (s === "blocked")
    return {
      number: "text-red-600 dark:text-red-400",
      badge: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
    };
  if (s === "new" || s === "to do" || s === "open" || s === "backlog")
    return {
      number: "text-gray-500 dark:text-gray-400",
      badge: "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800/40 dark:text-gray-300 dark:border-gray-700",
    };
  return {
    number: "text-muted-foreground",
    badge: "bg-muted text-muted-foreground border-border",
  };
}

// Canonical statuses that always appear (in display order), even with 0 count.
// Each entry maps a display label to the set of Jira status names it covers.
const CANONICAL_STATUSES: { label: string; matches: string[] }[] = [
  { label: "New", matches: ["new"] },
  { label: "Backlog", matches: ["backlog", "open", "to do"] },
  { label: "In Progress", matches: ["in progress", "in development"] },
  { label: "Review", matches: ["review", "code review", "in review", "peer review"] },
  { label: "Testing", matches: ["testing", "qa", "in testing", "ready for testing"] },
  { label: "Closed", matches: ["closed", "done"] },
  { label: "Resolved", matches: ["resolved"] },
];

function scrollToGroup(label: string) {
  // Try the label itself first, then check canonical matches for alternate names
  const el = document.getElementById(groupAnchorId(label));
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  // Try alternate status names from the canonical bucket
  const bucket = CANONICAL_STATUSES.find((s) => s.label === label);
  if (bucket) {
    for (const match of bucket.matches) {
      const alt = document.getElementById(groupAnchorId(match));
      if (alt) {
        alt.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
  }
}

export function IssueStatusSummary({ issues, onStatusClick }: IssueStatusSummaryProps) {
  const statusCounts = useMemo(() => {
    // Count issues per canonical status bucket
    const counts = CANONICAL_STATUSES.map(({ label, matches }) => {
      const matchSet = new Set(matches);
      const count = issues.filter((i) => matchSet.has(i.state.toLowerCase())).length;
      return { label, count, matches };
    });

    // Collect any issues with statuses not covered by canonical buckets
    const allMatched = new Set(CANONICAL_STATUSES.flatMap((s) => s.matches));
    const uncategorized = new Map<string, number>();
    for (const issue of issues) {
      if (!allMatched.has(issue.state.toLowerCase())) {
        uncategorized.set(issue.state, (uncategorized.get(issue.state) ?? 0) + 1);
      }
    }

    // Append any uncategorized statuses at the end
    const extras = [...uncategorized.entries()].map(([label, count]) => ({
      label,
      count,
      matches: [label.toLowerCase()],
    }));

    return [...counts, ...extras];
  }, [issues]);

  const totalPoints = useMemo(() => {
    let total = 0;
    let completed = 0;
    for (const issue of issues) {
      const pts = issue.storyPoints ?? 0;
      total += pts;
      const s = issue.state.toLowerCase();
      if (["done", "closed", "resolved"].includes(s)) {
        completed += pts;
      }
    }
    return { total, completed };
  }, [issues]);

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-end justify-center gap-8">
        {statusCounts.map(({ label, count }) => {
          const colors = getStatusColors(label);
          return (
            <button
              key={label}
              className="flex flex-col items-center gap-1.5 cursor-pointer rounded-lg px-3 py-2 transition-colors hover:bg-muted/60"
              onClick={() => {
                onStatusClick?.(label);
                // Delay scroll slightly to let groupBy change re-render the groups
                setTimeout(() => scrollToGroup(label), 50);
              }}
            >
              <span className={`text-3xl font-bold ${colors.number}`}>
                {count}
              </span>
              <span
                className={`rounded-md border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${colors.badge}`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
      {totalPoints.total > 0 && (
        <div className="mt-3 text-center text-sm text-muted-foreground">
          {totalPoints.completed}/{totalPoints.total} story points completed
        </div>
      )}
    </div>
  );
}
