// T063: Activity Timeline route view

import { useState, useMemo, Fragment } from "react";
import { trpc } from "../trpc";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingIndicator } from "@/components/shared/LoadingIndicator";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function formatActionType(actionType: string): string {
  return actionType
    .replace(/_/g, " ")
    .replace(/\bpr\b/gi, "PR")
    .replace(/^(\w)/, (c) => c.toUpperCase());
}

function getTargetLink(event: ActivityEvent): { label: string; url: string } | null {
  if (event.source === "github") {
    // targetKey is the full PR URL, e.g. https://github.com/org/repo/pull/123
    const match = event.targetKey.match(/\/pull\/(\d+)$/);
    if (match) {
      return { label: `#${match[1]}`, url: event.targetKey };
    }
  } else if (event.source === "jira") {
    // targetKey is the full Jira URL, e.g. https://issues.redhat.com/browse/RHOAIENG-12345
    const match = event.targetKey.match(/\/browse\/(.+)$/);
    if (match) {
      return { label: match[1], url: event.targetKey };
    }
  }
  return null;
}

// Same card styling used in PRTable
const groupCardStyles = [
  "[&_td]:bg-card [&_td]:border-border [&_td]:border-b",
  "[&_tr:first-child_td]:border-t",
  "[&_tr_td:first-child]:border-l [&_tr_td:last-child]:border-r",
  "[&_tr:first-child_td:first-child]:rounded-tl-lg [&_tr:first-child_td:last-child]:rounded-tr-lg",
  "[&_tr:last-child_td:first-child]:rounded-bl-lg [&_tr:last-child_td:last-child]:rounded-br-lg",
  "[&_tr:last-child_td]:border-b",
  "[&_tr:hover_td]:bg-muted/50",
].join(" ");

interface ActivityEvent {
  id: string;
  source: string;
  timestamp: string;
  actor: string;
  actorDisplayName: string;
  actionType: string;
  targetType: string;
  targetKey: string;
  targetTitle: string;
  detail: string | null;
}

function CollapsibleDayGroup({
  day,
  events,
}: {
  day: string;
  events: ActivityEvent[];
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <TableBody className={groupCardStyles}>
      <TableRow
        className="cursor-pointer hover:!bg-transparent"
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell colSpan={5} className="py-2.5 px-3 !bg-muted/40 hover:!bg-muted/60">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-semibold">{day}</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {events.length}
            </span>
          </div>
        </TableCell>
      </TableRow>
      {expanded &&
        events.map((event) => (
          <TableRow key={event.id}>
            <TableCell className="w-20">
              <StatusBadge
                label={event.source === "github" ? "GitHub" : "Jira"}
                variant="info"
                className={
                  event.source === "github"
                    ? "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800"
                    : "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800"
                }
              />
            </TableCell>
            <TableCell className="w-24 text-xs text-muted-foreground whitespace-nowrap">
              {new Date(event.timestamp).toLocaleTimeString()}
            </TableCell>
            <TableCell className="w-40 text-sm font-medium whitespace-nowrap">
              {formatActionType(event.actionType)}
            </TableCell>
            <TableCell className="w-32 text-xs text-muted-foreground whitespace-nowrap">
              {event.detail}
            </TableCell>
            <TableCell className="text-sm truncate max-w-md" title={event.targetTitle}>
              {(() => {
                const link = getTargetLink(event);
                return link ? (
                  <>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400 mr-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {link.label}
                    </a>
                    {event.targetTitle}
                  </>
                ) : (
                  event.targetTitle
                );
              })()}
            </TableCell>
          </TableRow>
        ))}
    </TableBody>
  );
}

export default function ActivityTimeline() {
  const configQuery = trpc.config.get.useQuery();
  const [days, setDays] = useState(7);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const username = configQuery.data?.config.githubIdentity ?? "";

  const githubActivity = trpc.github.getActivity.useQuery(
    { username, days },
    { enabled: !!username },
  );
  const jiraActivity = trpc.jira.getActivity.useQuery(
    { username: configQuery.data?.config.jiraIdentity ?? "", days },
    { enabled: !!configQuery.data?.config.jiraIdentity },
  );

  const allEvents = useMemo(() => {
    const gh = githubActivity.data?.events ?? [];
    const jira = jiraActivity.data?.events ?? [];
    const sorted = [...gh, ...jira].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return sortOrder === "oldest" ? sorted.reverse() : sorted;
  }, [githubActivity.data, jiraActivity.data, sortOrder]);

  // Group by day
  const groupedByDay = useMemo(() => {
    const groups = new Map<string, typeof allEvents>();
    for (const event of allEvents) {
      const day = new Date(event.timestamp).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const existing = groups.get(day) ?? [];
      existing.push(event);
      groups.set(day, existing);
    }
    return [...groups.entries()];
  }, [allEvents]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">My Activity Timeline</h1>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort:</span>
          <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "newest" | "oldest")}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Time window:</span>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Today</SelectItem>
              <SelectItem value="3">Last 3 days</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {(githubActivity.isLoading || jiraActivity.isLoading) && (
        <LoadingIndicator message="Loading activity..." />
      )}
      {githubActivity.error && (
        <ErrorBanner message={`GitHub: ${githubActivity.error.message}`} />
      )}
      {jiraActivity.error && (
        <ErrorBanner message={`Jira: ${jiraActivity.error.message}`} />
      )}

      {groupedByDay.length > 0 && (
        <Table className="border-separate border-spacing-0">
          <TableHeader>
            <TableRow className="border-none hover:bg-transparent">
              <TableHead className="border-none w-20">Source</TableHead>
              <TableHead className="border-none w-24">Time</TableHead>
              <TableHead className="border-none w-40">Action</TableHead>
              <TableHead className="border-none w-32">Detail</TableHead>
              <TableHead className="border-none">Target</TableHead>
            </TableRow>
          </TableHeader>
          {groupedByDay.map(([day, events], index) => (
            <Fragment key={day}>
              {index > 0 && (
                <tbody aria-hidden>
                  <tr>
                    <td colSpan={5} className="h-6 p-0 border-none" />
                  </tr>
                </tbody>
              )}
              <CollapsibleDayGroup day={day} events={events} />
            </Fragment>
          ))}
        </Table>
      )}

      {!githubActivity.isLoading && !jiraActivity.isLoading && allEvents.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">No activity found</p>
      )}
    </div>
  );
}
