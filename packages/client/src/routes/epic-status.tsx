// Epic Status route — uses shared JiraIssueTable

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { trpc } from "../trpc";
import { JiraIssueTable } from "@/components/jira-table/JiraIssueTable";
import { LoadingIndicator } from "@/components/shared/LoadingIndicator";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { RefreshControls } from "@/components/controls/RefreshControls";
import { useAutoRefreshContext } from "@/hooks/useAutoRefreshContext";
import { useDetailModal } from "@/components/detail-modal/DetailModalProvider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ExternalLinkButtonGroup } from "@/components/ExternalLinkButtonGroup";

export default function EpicStatus() {
  const configQuery = trpc.config.get.useQuery();
  const viewer = configQuery.data?.config.githubIdentity ?? "";
  const jiraHost = configQuery.data?.jiraHost ?? "";

  const { autoRefresh, setAutoRefresh, intervalMs, setIntervalMs, refetchInterval } =
    useAutoRefreshContext();

  const { epicKey: epicKeyParam } = useParams<{ epicKey: string }>();
  const navigate = useNavigate();
  const [customEpicKey, setCustomEpicKey] = useState(epicKeyParam?.toUpperCase() ?? "");
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Fetch sprint issues to discover epics
  const sprintQuery = trpc.jira.getSprintIssues.useQuery(undefined, {
    refetchInterval,
  });

  const sprintEpics = useMemo(() => {
    if (!sprintQuery.data) return [];
    const epicMap = new Map<string, string>();
    for (const issue of sprintQuery.data.issues) {
      if (issue.epicKey && !epicMap.has(issue.epicKey)) {
        epicMap.set(issue.epicKey, issue.epicSummary ?? "");
      }
    }
    return [...epicMap.entries()]
      .map(([key, summary]) => ({ key, summary }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [sprintQuery.data]);

  const activeEpicKey = epicKeyParam?.toUpperCase() || "";
  // Determine if the current route param matches a sprint epic or is a custom key
  const isKnownSprintEpic = sprintEpics.some((e) => e.key === activeEpicKey);
  const isCustom = !!activeEpicKey && !isKnownSprintEpic;
  // The select value: match a sprint epic, show "other" for custom keys, or empty
  const selectValue = isKnownSprintEpic ? activeEpicKey : (isCustom || showCustomInput) ? "__other__" : "";


  const epicQuery = trpc.jira.getEpicIssues.useQuery(
    { epicKey: activeEpicKey, includeClosedResolved: true },
    { enabled: !!activeEpicKey, refetchInterval },
  );

  // Collect unique PR URLs for batch fetch
  const linkedPRUrls = useMemo(() => {
    if (!epicQuery.data) return [];
    const urls = new Set<string>();
    for (const issue of epicQuery.data.issues) {
      for (const url of issue.linkedPRUrls) urls.add(url);
    }
    return [...urls];
  }, [epicQuery.data]);

  const linkedPRsQuery = trpc.github.getPRsByUrls.useQuery(
    { prUrls: linkedPRUrls },
    { enabled: linkedPRUrls.length > 0, refetchInterval },
  );

  const refetch = useCallback(() => {
    sprintQuery.refetch();
    epicQuery.refetch();
    linkedPRsQuery.refetch();
  }, [sprintQuery, epicQuery, linkedPRsQuery]);

  // Register data with detail modal
  const { registerPRs, registerJiraIssues } = useDetailModal();
  useEffect(() => {
    if (epicQuery.data) registerJiraIssues(epicQuery.data.issues);
  }, [epicQuery.data, registerJiraIssues]);
  useEffect(() => {
    if (linkedPRsQuery.data) registerPRs(linkedPRsQuery.data.prs);
  }, [linkedPRsQuery.data, registerPRs]);

  const epicUrl = activeEpicKey && jiraHost
    ? `https://${jiraHost}/browse/${activeEpicKey}`
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Epic Status</h1>
        <div className="flex items-center gap-4">
          {epicQuery.data && (
            <span className="text-xs text-muted-foreground">
              Jira: {new Date(epicQuery.data.fetchedAt).toLocaleTimeString()}
            </span>
          )}
          <RefreshControls
            autoRefresh={autoRefresh}
            onAutoRefreshChange={setAutoRefresh}
            intervalMs={intervalMs}
            onIntervalChange={setIntervalMs}
            onManualRefresh={refetch}
            lastRefreshedAt={epicQuery.data?.fetchedAt}
            isFetching={epicQuery.isFetching || linkedPRsQuery.isFetching}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Jira issues for a selected epic, correlated with GitHub PR status and review data. Epics discovered from the current sprint are shown in the dropdown, or enter any epic key manually.
      </p>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Epic:</span>
          <Select
            value={selectValue}
            onValueChange={(v) => {
              if (v === "__other__") {
                setCustomEpicKey("");
                setShowCustomInput(true);
                navigate("/epic", { replace: true });
              } else {
                setCustomEpicKey("");
                setShowCustomInput(false);
                navigate(`/epic/${encodeURIComponent(v)}`, { replace: true });
              }
            }}
          >
            <SelectTrigger className="h-9 w-auto min-w-[240px] text-base" aria-label="Select epic">
              <SelectValue placeholder="Select an epic..." />
            </SelectTrigger>
            <SelectContent>
              {sprintQuery.isLoading && (
                <SelectItem value="__loading__" disabled className="text-sm text-muted-foreground">
                  Loading sprint epics...
                </SelectItem>
              )}
              {sprintEpics.map((epic) => (
                <SelectItem key={epic.key} value={epic.key} className="text-sm">
                  ⚡ {epic.key}{epic.summary ? `: ${epic.summary}` : ""}
                </SelectItem>
              ))}
              {sprintEpics.length > 0 && <SelectSeparator />}
              <SelectItem value="__other__" className="text-sm">
                Other (enter key)...
              </SelectItem>
            </SelectContent>
          </Select>
          {epicUrl && (
            <ExternalLinkButtonGroup href={epicUrl} label="Open on Jira" />
          )}
        </div>

        {(isCustom || showCustomInput) && (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const key = customEpicKey.trim().toUpperCase();
              if (key) navigate(`/epic/${encodeURIComponent(key)}`, { replace: true });
            }}
          >
            <input
              type="text"
              placeholder="e.g. RHOAIENG-123"
              value={customEpicKey}
              onChange={(e) => setCustomEpicKey(e.target.value)}
              aria-label="Epic key"
              className="h-8 rounded-md border border-input bg-background px-3 text-sm"
            />
            <Button type="submit" size="sm" disabled={!customEpicKey.trim()}>
              Load
            </Button>
          </form>
        )}
      </div>

      {epicQuery.error && <ErrorBanner message={epicQuery.error.message} />}
      {epicQuery.isLoading && <LoadingIndicator message="Loading epic issues..." />}

      {epicQuery.data && epicQuery.data.issues.length > 0 && (
        <JiraIssueTable
          issues={epicQuery.data.issues}
          linkedPRs={linkedPRsQuery.data?.prs ?? []}
          isPRsLoading={linkedPRsQuery.isLoading}
          viewer={viewer}
        />
      )}

      {!activeEpicKey && !sprintQuery.isLoading && (
        <p className="py-8 text-center text-muted-foreground">
          Select an epic to view its issues
        </p>
      )}

      {!epicQuery.isLoading && activeEpicKey && epicQuery.data?.issues.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">No issues found in this epic</p>
      )}
    </div>
  );
}
