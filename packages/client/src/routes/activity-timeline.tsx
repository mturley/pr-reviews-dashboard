// T063: Activity Timeline route view

import { useState, useMemo, useCallback, Fragment } from "react";
import { AppLink } from "@/components/shared/AppLink";
import { trpc } from "../trpc";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingIndicator } from "@/components/shared/LoadingIndicator";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { RefreshControls } from "@/components/controls/RefreshControls";
import { useAutoRefreshContext } from "@/hooks/useAutoRefreshContext";
import { ChevronDown, ChevronRight, GitPullRequest, GitMerge, GitCommit, CircleDot, CircleDashed, Eye, MessageSquare, ArrowRightLeft, Pencil, PlusCircle } from "lucide-react";
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

const actionTypeLabels: Record<string, string> = {
  pr_pushed: "Commits pushed",
};

function formatActionType(actionType: string): string {
  if (actionTypeLabels[actionType]) return actionTypeLabels[actionType];
  return actionType
    .replace(/_/g, " ")
    .replace(/\bpr\b/gi, "PR")
    .replace(/^(\w)/, (c) => c.toUpperCase());
}

function ActionIcon({ actionType }: { actionType: string }) {
  switch (actionType) {
    case "pr_opened":
      return <GitPullRequest className="h-4 w-4 text-green-600 dark:text-green-400" />;
    case "pr_merged":
      return <GitMerge className="h-4 w-4 text-purple-600 dark:text-purple-400" />;
    case "pr_closed":
      return <CircleDot className="h-4 w-4 text-red-600 dark:text-red-400" />;
    case "pr_reviewed":
      return <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
    case "pr_commented":
    case "issue_commented":
      return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
    case "pr_pushed":
      return <GitCommit className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
    case "issue_status_changed":
      return <ArrowRightLeft className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
    case "issue_field_changed":
      return <Pencil className="h-4 w-4 text-muted-foreground" />;
    case "issue_created":
      return <PlusCircle className="h-4 w-4 text-green-600 dark:text-green-400" />;
    default:
      return null;
  }
}

function getTargetLink(event: ActivityEvent): { label: string; url: string } | null {
  if (event.source === "github") {
    const match = event.targetKey.match(/\/pull\/(\d+)$/);
    if (match) {
      return { label: `#${match[1]}`, url: event.targetKey };
    }
  } else if (event.source === "jira") {
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
  jiraTypeIconUrl?: string | null;
  jiraType?: string | null;
  epicKey?: string | null;
  epicSummary?: string | null;
  epicUrl?: string | null;
  prState?: "OPEN" | "MERGED" | "CLOSED" | "DRAFT" | null;
  prAuthor?: string | null;
}

function PRStateIcon({ state }: { state: string | null | undefined }) {
  switch (state) {
    case "MERGED":
      return <GitMerge className="h-4 w-4 text-purple-600 dark:text-purple-400" />;
    case "CLOSED":
      return <CircleDot className="h-4 w-4 text-red-600 dark:text-red-400" />;
    case "DRAFT":
      return <CircleDashed className="h-4 w-4 text-muted-foreground" />;
    case "OPEN":
      return <GitPullRequest className="h-4 w-4 text-green-600 dark:text-green-400" />;
    default:
      return null;
  }
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
              <span className="flex items-center gap-1.5">
                <ActionIcon actionType={event.actionType} />
                {formatActionType(event.actionType)}
              </span>
            </TableCell>
            <TableCell className="w-32 text-xs text-muted-foreground whitespace-nowrap">
              {event.detail}
            </TableCell>
            <TableCell className="text-sm max-w-md" title={event.targetTitle}>
              <div className="flex items-center gap-1.5">
                {event.source === "github" && event.prState && (
                  <PRStateIcon state={event.prState} />
                )}
                {event.source === "jira" && event.jiraTypeIconUrl && (
                  <img src={event.jiraTypeIconUrl} alt={event.jiraType ?? ""} className="h-4 w-4 shrink-0" />
                )}
                {(() => {
                  const link = getTargetLink(event);
                  return link ? (
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {link.label}
                    </a>
                  ) : null;
                })()}
                <span className="truncate">{event.targetTitle}</span>
                {event.source === "github" && event.prAuthor && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    by {event.prAuthor}
                  </span>
                )}
                {event.epicKey && event.epicUrl && (
                  <span className="shrink-0 text-xs text-muted-foreground flex items-center gap-0.5">
                    ·
                    <span className="text-green-600 dark:text-green-400">⚡</span>
                    <AppLink
                      href={event.epicUrl}
                      epicKey={event.epicKey}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {event.epicKey}
                    </AppLink>
                    {event.epicSummary && (
                      <span className="ml-1">{event.epicSummary}</span>
                    )}
                  </span>
                )}
              </div>
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

  const { autoRefresh, setAutoRefresh, intervalMs, setIntervalMs, refetchInterval } =
    useAutoRefreshContext();

  const githubActivity = trpc.github.getActivity.useQuery(
    { username, days },
    { enabled: !!username, refetchInterval },
  );
  const jiraActivity = trpc.jira.getActivity.useQuery(
    { username: configQuery.data?.config.jiraIdentity ?? "", days },
    { enabled: !!configQuery.data?.config.jiraIdentity, refetchInterval },
  );

  const refetch = useCallback(() => {
    githubActivity.refetch();
    jiraActivity.refetch();
  }, [githubActivity, jiraActivity]);

  const latestFetchedAt = useMemo(() => {
    const gh = githubActivity.data?.fetchedAt;
    const jira = jiraActivity.data?.fetchedAt;
    if (gh && jira) return gh > jira ? gh : jira;
    return gh ?? jira ?? null;
  }, [githubActivity.data?.fetchedAt, jiraActivity.data?.fetchedAt]);

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Activity Timeline</h1>
        <RefreshControls
          autoRefresh={autoRefresh}
          onAutoRefreshChange={setAutoRefresh}
          intervalMs={intervalMs}
          onIntervalChange={setIntervalMs}
          onManualRefresh={refetch}
          lastRefreshedAt={latestFetchedAt}
          isFetching={githubActivity.isFetching || jiraActivity.isFetching}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Recent GitHub PR activity and Jira issue updates for your configured identity, combined into a unified timeline.
      </p>

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
