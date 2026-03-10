// T063: Activity Timeline route view

import { useState, useMemo } from "react";
import { trpc } from "../trpc";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { LoadingIndicator } from "@/components/shared/LoadingIndicator";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Activity Timeline</h1>
        <div className="flex items-center gap-4">
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
              <SelectTrigger className="h-8 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 day</SelectItem>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
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

      {groupedByDay.map(([day, events]) => (
        <div key={day} className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{day}</h2>
          <div className="space-y-1">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
              >
                <StatusBadge
                  label={event.source}
                  variant={event.source === "github" ? "info" : "warning"}
                  className="shrink-0"
                />
                <span className="text-xs text-muted-foreground">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
                <span className="text-sm font-medium">{event.actionType.replace(/_/g, " ")}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{event.targetTitle}</span>
                {event.detail && (
                  <span className="text-xs text-muted-foreground">{event.detail}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {!githubActivity.isLoading && !jiraActivity.isLoading && allEvents.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">No activity found</p>
      )}
    </div>
  );
}
