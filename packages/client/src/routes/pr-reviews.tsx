// PR Reviews route — full integration

import { useMemo } from "react";
import { trpc } from "../trpc";
import { computeReviewStatus } from "../../../server/src/logic/review-status";
import { groupPRs } from "../../../server/src/logic/grouping";
import { deriveRecommendedActions } from "../../../server/src/logic/recommended-actions";
import type { PullRequest, ReviewStatusResult } from "../../../server/src/types/pr";
import { useProgressiveData } from "@/hooks/useProgressiveData";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useViewState } from "@/hooks/useViewState";
import { PRTable } from "@/components/pr-table/PRTable";
import { ActionsPanel } from "@/components/actions-panel/ActionsPanel";
import { RefreshControls } from "@/components/controls/RefreshControls";
import { GroupBySelector } from "@/components/controls/GroupBySelector";
import { FilterBar } from "@/components/controls/FilterBar";
import { PerspectiveSelector } from "@/components/controls/PerspectiveSelector";
import { ColumnCustomizer, useColumnConfig } from "@/components/controls/ColumnCustomizer";
import { LoadingIndicator } from "@/components/shared/LoadingIndicator";
import { ErrorBanner } from "@/components/shared/ErrorBanner";

export default function PRReviews() {
  const configQuery = trpc.config.get.useQuery();
  const config = configQuery.data?.config;
  const allTeamMembers = useMemo(() => config?.teamMembers ?? [], [config?.teamMembers]);
  const teamMemberUsernames = useMemo(
    () => allTeamMembers.map((m) => m.githubUsername),
    [allTeamMembers],
  );

  const { viewState, updateViewState } = useViewState();
  const { columns: columnConfig, setColumns: setColumnConfig, visibleColumnIds } = useColumnConfig();

  // Perspective: use URL param or fall back to config identity
  const perspective = viewState.perspective || config?.githubIdentity || "";
  const isTeamView = perspective === "team";
  const viewer = isTeamView ? "" : perspective;

  const defaultInterval = config?.autoRefreshIntervalMs ?? 300_000;
  const { autoRefresh, setAutoRefresh, intervalMs, setIntervalMs, refetchInterval } =
    useAutoRefresh(defaultInterval);

  const data = useProgressiveData({ refetchInterval });

  // Filtering
  const filteredPRs = useMemo(() => {
    let prs = data.prs;

    if (viewState.filterRepo.length > 0) {
      prs = prs.filter((pr) =>
        viewState.filterRepo.includes(`${pr.repoOwner}/${pr.repoName}`),
      );
    }
    if (!viewState.filterDraft) {
      prs = prs.filter((pr) => !pr.isDraft);
    }

    return prs;
  }, [data.prs, viewState.filterRepo, viewState.filterDraft]);

  // Available repos for filter
  const availableRepos = useMemo(() => {
    const repos = new Set(data.prs.map((pr) => `${pr.repoOwner}/${pr.repoName}`));
    return [...repos].sort();
  }, [data.prs]);

  const reviewStatuses = useMemo(() => {
    const map = new Map<string, ReviewStatusResult>();
    if (!viewer && !isTeamView) return map;
    for (const pr of filteredPRs) {
      map.set(pr.id, computeReviewStatus(pr, viewer));
    }
    return map;
  }, [filteredPRs, viewer, isTeamView]);

  // Filter by action needed
  const displayPRs = useMemo(() => {
    if (!viewState.filterActionNeeded) return filteredPRs;
    return filteredPRs.filter((pr) => {
      const status = reviewStatuses.get(pr.id);
      return status?.action != null;
    });
  }, [filteredPRs, viewState.filterActionNeeded, reviewStatuses]);

  const groups = useMemo(() => {
    if (displayPRs.length === 0) return [];
    if (isTeamView || viewState.groupBy === "flat") {
      return [
        {
          id: "all",
          label: isTeamView ? "All Team PRs" : "All PRs",
          prs: displayPRs,
          emptyMessage: "No PRs",
        },
      ];
    }
    if (viewState.groupBy === "repository") {
      return groupByRepo(displayPRs);
    }
    return groupPRs(displayPRs, {
      viewerGithubUsername: viewer,
      teamMembers: teamMemberUsernames,
      sprintName: data.sprintName ?? undefined,
    });
  }, [displayPRs, viewer, teamMemberUsernames, data.sprintName, viewState.groupBy, isTeamView]);

  const actions = useMemo(
    () => deriveRecommendedActions(displayPRs, reviewStatuses),
    [displayPRs, reviewStatuses],
  );

  if (configQuery.isLoading) {
    return <LoadingIndicator message="Loading configuration..." />;
  }

  if (configQuery.error) {
    return <ErrorBanner message={`Config error: ${configQuery.error.message}`} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          My PRs and Reviews{data.sprintName ? ` for ${data.sprintName}` : ""}
        </h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {data.githubFetchedAt && (
              <span>GitHub: {new Date(data.githubFetchedAt).toLocaleTimeString()}</span>
            )}
            {data.jiraFetchedAt && (
              <span>Jira: {new Date(data.jiraFetchedAt).toLocaleTimeString()}</span>
            )}
            {data.rateLimitRemaining !== null && (
              <span>Rate limit: {data.rateLimitRemaining}</span>
            )}
            {data.isJiraLoading && <span>Jira loading...</span>}
            {data.isCascadeLoading && <span>Fetching linked PRs...</span>}
          </div>
          <RefreshControls
            autoRefresh={autoRefresh}
            onAutoRefreshChange={setAutoRefresh}
            intervalMs={intervalMs}
            onIntervalChange={setIntervalMs}
            onManualRefresh={data.refetch}
            lastRefreshedAt={data.githubFetchedAt}
            isFetching={data.isFetching}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-3">
        <PerspectiveSelector
          value={perspective}
          onChange={(v) => updateViewState({ perspective: v })}
          teamMembers={allTeamMembers}
          currentUser={config?.githubIdentity ?? ""}
        />
        <GroupBySelector
          value={viewState.groupBy}
          onChange={(v) => updateViewState({ groupBy: v })}
        />
        <ColumnCustomizer columns={columnConfig} onColumnsChange={setColumnConfig} />
      </div>

      <FilterBar
        actionNeeded={viewState.filterActionNeeded}
        onActionNeededChange={(v) => updateViewState({ filterActionNeeded: v })}
        showDraft={viewState.filterDraft}
        onShowDraftChange={(v) => updateViewState({ filterDraft: v })}
        repos={availableRepos}
        selectedRepos={viewState.filterRepo}
        onRepoFilterChange={(v) => updateViewState({ filterRepo: v })}
      />

      {data.githubError && (
        <ErrorBanner message={`GitHub error: ${data.githubError.message}`} />
      )}
      {data.jiraError && (
        <ErrorBanner message={`Jira error: ${data.jiraError.message}`} />
      )}

      <ActionsPanel actions={actions} />

      {data.isGitHubLoading ? (
        <LoadingIndicator message="Fetching GitHub PRs..." />
      ) : displayPRs.length === 0 && !data.isJiraLoading ? (
        <p className="py-8 text-center text-muted-foreground">
          {data.prs.length === 0
            ? "No open pull requests found"
            : "No pull requests match the current filters"}
        </p>
      ) : (
        <PRTable
          groups={groups}
          reviewStatuses={reviewStatuses}
          isJiraLoading={data.isJiraLoading}
          visibleColumnIds={visibleColumnIds}
        />
      )}
    </div>
  );
}

function groupByRepo(prs: PullRequest[]) {
  const repoMap = new Map<string, PullRequest[]>();
  for (const pr of prs) {
    const key = `${pr.repoOwner}/${pr.repoName}`;
    const list = repoMap.get(key) ?? [];
    list.push(pr);
    repoMap.set(key, list);
  }
  return [...repoMap.entries()].map(([repo, repoPRs]) => ({
    id: repo,
    label: repo,
    prs: repoPRs,
    emptyMessage: `No PRs in ${repo}`,
  }));
}
