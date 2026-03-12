// Sprint Status route — uses shared JiraIssueTable

import { useEffect, useMemo, useCallback } from "react";
import { trpc } from "../trpc";
import { JiraIssueTable } from "@/components/jira-table/JiraIssueTable";
import { LoadingIndicator } from "@/components/shared/LoadingIndicator";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { RefreshControls } from "@/components/controls/RefreshControls";
import { useAutoRefreshContext } from "@/hooks/useAutoRefreshContext";
import { useDetailModal } from "@/components/detail-modal/DetailModalProvider";

export default function SprintStatus() {
  const configQuery = trpc.config.get.useQuery();
  const viewer = configQuery.data?.config.githubIdentity ?? "";

  const { autoRefresh, setAutoRefresh, intervalMs, setIntervalMs, refetchInterval } =
    useAutoRefreshContext();

  const jiraQuery = trpc.jira.getSprintIssues.useQuery(undefined, {
    refetchInterval,
  });

  // Collect unique PR URLs for batch fetch
  const linkedPRUrls = useMemo(() => {
    if (!jiraQuery.data) return [];
    const urls = new Set<string>();
    for (const issue of jiraQuery.data.issues) {
      for (const url of issue.linkedPRUrls) urls.add(url);
    }
    return [...urls];
  }, [jiraQuery.data]);

  const linkedPRsQuery = trpc.github.getPRsByUrls.useQuery(
    { prUrls: linkedPRUrls },
    { enabled: linkedPRUrls.length > 0, refetchInterval },
  );

  const refetch = useCallback(() => {
    jiraQuery.refetch();
    linkedPRsQuery.refetch();
  }, [jiraQuery, linkedPRsQuery]);

  // Register data with detail modal
  const { registerPRs, registerJiraIssues } = useDetailModal();
  useEffect(() => {
    if (jiraQuery.data) registerJiraIssues(jiraQuery.data.issues);
  }, [jiraQuery.data, registerJiraIssues]);
  useEffect(() => {
    if (linkedPRsQuery.data) registerPRs(linkedPRsQuery.data.prs);
  }, [linkedPRsQuery.data, registerPRs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Sprint Status
          {jiraQuery.data && (
            jiraQuery.data.sprintUrl ? (
              <a
                href={jiraQuery.data.sprintUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-base font-normal text-blue-600 dark:text-blue-400 hover:underline"
              >
                {jiraQuery.data.sprintName}
              </a>
            ) : (
              <span className="ml-2 text-base font-normal text-muted-foreground">
                {jiraQuery.data.sprintName}
              </span>
            )
          )}
        </h1>
        <div className="flex items-center gap-4">
          {jiraQuery.data && (
            <span className="text-xs text-muted-foreground">
              Jira: {new Date(jiraQuery.data.fetchedAt).toLocaleTimeString()}
            </span>
          )}
          <RefreshControls
            autoRefresh={autoRefresh}
            onAutoRefreshChange={setAutoRefresh}
            intervalMs={intervalMs}
            onIntervalChange={setIntervalMs}
            onManualRefresh={refetch}
            lastRefreshedAt={jiraQuery.data?.fetchedAt}
            isFetching={jiraQuery.isFetching || linkedPRsQuery.isFetching}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        All Jira issues in your team's current sprint, correlated with GitHub PR status and review data for linked pull requests.
      </p>

      {jiraQuery.error && <ErrorBanner message={jiraQuery.error.message} />}
      {jiraQuery.isLoading && <LoadingIndicator message="Loading sprint issues..." />}

      {jiraQuery.data && (
        <JiraIssueTable
          issues={jiraQuery.data.issues}
          linkedPRs={linkedPRsQuery.data?.prs ?? []}
          isPRsLoading={linkedPRsQuery.isLoading}
          viewer={viewer}
        />
      )}
    </div>
  );
}
