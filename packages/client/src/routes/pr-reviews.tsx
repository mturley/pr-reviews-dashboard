// PR Reviews route — full integration

import { useCallback, useEffect, useMemo, useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "../trpc";
import { computeReviewStatus } from "../../../server/src/logic/review-status";
import { groupPRs } from "../../../server/src/logic/grouping";
import { deriveRecommendedActions } from "../../../server/src/logic/recommended-actions";
import type { PullRequest, ReviewStatusResult, PRGroup } from "../../../server/src/types/pr";
import type { ViewState } from "@/lib/url-state";
import type { TeamMember } from "../../../server/src/types/config";
import { useProgressiveData, type LoadingPhase } from "@/hooks/useProgressiveData";
import { useAutoRefreshContext } from "@/hooks/useAutoRefreshContext";
import { useViewState } from "@/hooks/useViewState";
import { PRTable } from "@/components/pr-table/PRTable";
import { ActionsPanel } from "@/components/actions-panel/ActionsPanel";
import { HowItWorksPanel } from "@/components/actions-panel/HowItWorksPanel";
import { RefreshControls } from "@/components/controls/RefreshControls";
import { GroupBySelector } from "@/components/controls/GroupBySelector";
import { FilterBar } from "@/components/controls/FilterBar";
import { PerspectiveSelector } from "@/components/controls/PerspectiveSelector";
import { ColumnCustomizer, useColumnConfig, type ColumnConfig } from "@/components/controls/ColumnCustomizer";
import { LoadingIndicator } from "@/components/shared/LoadingIndicator";
import { LoadingProgress } from "@/components/shared/LoadingProgress";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { useDetailModal } from "@/components/detail-modal/DetailModalProvider";

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

  const { autoRefresh, setAutoRefresh, intervalMs, setIntervalMs, refetchInterval } =
    useAutoRefreshContext();

  const data = useProgressiveData({ refetchInterval });

  // Register PR data with detail modal
  const { registerPRs } = useDetailModal();
  useEffect(() => {
    if (data.prs.length > 0) registerPRs(data.prs);
  }, [data.prs, registerPRs]);

  // Filtering
  const filteredPRs = useMemo(() => {
    let prs = data.prs;

    // Filter to team members + dependabot when toggle is on
    if (viewState.ignoreOtherTeams && teamMemberUsernames.length > 0) {
      const teamSet = new Set(teamMemberUsernames.map((u) => u.toLowerCase()));
      prs = prs.filter((pr) => {
        const authorLower = pr.author.toLowerCase();
        return teamSet.has(authorLower) || authorLower === "dependabot[bot]" || authorLower === "dependabot";
      });
    }

    if (viewState.filterRepo.length > 0) {
      prs = prs.filter((pr) =>
        viewState.filterRepo.includes(`${pr.repoOwner}/${pr.repoName}`),
      );
    }
    if (!viewState.filterDraft) {
      prs = prs.filter((pr) => !pr.isDraft);
    }

    return prs;
  }, [data.prs, viewState.ignoreOtherTeams, teamMemberUsernames, viewState.filterRepo, viewState.filterDraft]);

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
    if (viewState.groupBy === "epic") {
      return groupByEpic(displayPRs);
    }
    if (viewState.groupBy === "jiraPriority") {
      return groupByJiraPriority(displayPRs);
    }
    if (viewState.groupBy === "action") {
      return groupByAction(displayPRs, reviewStatuses);
    }
    return groupPRs(displayPRs, {
      viewerGithubUsername: viewer,
      teamMembers: teamMemberUsernames,
      sprintName: data.sprintName ?? undefined,
    });
  }, [displayPRs, viewer, teamMemberUsernames, data.sprintName, viewState.groupBy, isTeamView, reviewStatuses]);

  // When "Action needed only" filter is active, override empty messages to reflect filtering
  const displayGroups = useMemo(() => {
    if (!viewState.filterActionNeeded) return groups;
    return groups.map((group) => ({
      ...group,
      emptyMessage: "No action needed",
    }));
  }, [groups, viewState.filterActionNeeded]);

  // Only include PRs that appear in the table groups
  const groupedPRs = useMemo(() => {
    const ids = new Set<string>();
    for (const group of displayGroups) {
      for (const pr of group.prs) {
        ids.add(pr.id);
      }
    }
    return displayPRs.filter((pr) => ids.has(pr.id));
  }, [displayGroups, displayPRs]);

  const actions = useMemo(
    () => deriveRecommendedActions(groupedPRs, reviewStatuses),
    [groupedPRs, reviewStatuses],
  );

  const configPhase: LoadingPhase = {
    label: "Configuration",
    status: configQuery.isLoading ? "active"
      : configQuery.isError ? "error"
      : configQuery.isSuccess ? "done" : "pending",
    detail: configQuery.error?.message,
  };

  const allPhases = [configPhase, ...data.phases];

  if (configQuery.isLoading) {
    return (
      <div className="space-y-4">
        <LoadingProgress phases={allPhases} />
      </div>
    );
  }

  if (configQuery.error) {
    return (
      <div className="space-y-4">
        <LoadingProgress phases={allPhases} />
        <ErrorBanner message={`Config error: ${configQuery.error.message}`} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <LoadingProgress phases={allPhases} />

      {data.githubError && (
        <ErrorBanner message={`GitHub error: ${data.githubError.message}`} />
      )}
      {data.jiraError && (
        <ErrorBanner message={`Jira error: ${data.jiraError.message}`} />
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          My PRs and Reviews
          {data.sprintName && (
            data.sprintUrl ? (
              <a
                href={data.sprintUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-base font-normal text-blue-600 dark:text-blue-400 hover:underline"
              >
                {data.sprintName}
              </a>
            ) : (
              <span className="ml-2 text-base font-normal text-muted-foreground">
                {data.sprintName}
              </span>
            )
          )}
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
              <span title={data.rateLimitResetAt ? `Resets at ${new Date(data.rateLimitResetAt).toLocaleTimeString()}` : undefined}>
                GitHub rate limit: {data.rateLimitRemaining}{data.rateLimitLimit ? ` / ${data.rateLimitLimit}` : ""}
                {data.rateLimitResetAt && <> (resets in <LiveRelativeTime isoString={data.rateLimitResetAt} />)</>}
              </span>
            )}
          </div>
          <RefreshControls
            autoRefresh={autoRefresh}
            onAutoRefreshChange={setAutoRefresh}
            intervalMs={intervalMs}
            onIntervalChange={setIntervalMs}
            onManualRefresh={data.refetch}

            isFetching={data.isFetching}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Open pull requests from your team's GitHub repos, enriched with Jira sprint data and review status. Filter, group, and prioritize PRs that need your attention.
      </p>

      <ViewOptionsBar
        perspective={perspective}
        viewState={viewState}
        updateViewState={updateViewState}
        allTeamMembers={allTeamMembers}
        currentUser={config?.githubIdentity ?? ""}
        columnConfig={columnConfig}
        setColumnConfig={setColumnConfig}
        availableRepos={availableRepos}
      />

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
          groups={displayGroups}
          reviewStatuses={reviewStatuses}
          isJiraLoading={data.isJiraLoading}
          visibleColumnIds={visibleColumnIds}
        />
      )}
    </div>
  );
}

const GROUP_BY_LABELS: Record<string, string> = {
  default: "My Stuff",
  action: "Action Needed",
  repository: "Repository",
  epic: "Epic",
  jiraPriority: "Jira Priority",
  flat: "Flat",
};

function ViewOptionsBar({
  perspective,
  viewState,
  updateViewState,
  allTeamMembers,
  currentUser,
  columnConfig,
  setColumnConfig,
  availableRepos,
}: {
  perspective: string;
  viewState: ViewState;
  updateViewState: (patch: Partial<ViewState>) => void;
  allTeamMembers: TeamMember[];
  currentUser: string;
  columnConfig: ColumnConfig[];
  setColumnConfig: (columns: ColumnConfig[]) => void;
  availableRepos: string[];
}) {
  const [showOptions, setShowOptions] = useState(false);

  const perspectiveName =
    perspective === "team"
      ? "Whole Team"
      : allTeamMembers.find((m) => m.githubUsername === perspective)?.displayName ?? perspective;

  const filters: string[] = [];
  if (viewState.filterActionNeeded) filters.push("Action needed only");
  if (!viewState.filterDraft) filters.push("Ignore drafts");
  if (viewState.ignoreOtherTeams) filters.push("Ignore PRs from other scrums");
  if (viewState.filterRepo.length > 0)
    filters.push(`${viewState.filterRepo.length} repo${viewState.filterRepo.length > 1 ? "s" : ""}`);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <HowItWorksPanel />
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setShowOptions(!showOptions)}
        >
          <Settings className="h-4 w-4" />
          {showOptions ? "Hide view options" : "Show view options"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Viewing as <span className="font-medium text-foreground">{perspectiveName}</span>
          {" · "}Grouped by <span className="font-medium text-foreground">{GROUP_BY_LABELS[viewState.groupBy] ?? viewState.groupBy}</span>
          {filters.length > 0 && (
            <>
              {" · "}
              {filters.join(", ")}
            </>
          )}
        </span>
      </div>
      {showOptions && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-3">
          <PerspectiveSelector
            value={perspective}
            onChange={(v) => updateViewState({ perspective: v })}
            teamMembers={allTeamMembers}
            currentUser={currentUser}
          />
          <GroupBySelector
            value={viewState.groupBy}
            onChange={(v) => updateViewState({ groupBy: v })}
          />
          <FilterBar
            actionNeeded={viewState.filterActionNeeded}
            onActionNeededChange={(v) => updateViewState({ filterActionNeeded: v })}
            showDraft={viewState.filterDraft}
            onShowDraftChange={(v) => updateViewState({ filterDraft: v })}
            ignoreOtherTeams={viewState.ignoreOtherTeams}
            onIgnoreOtherTeamsChange={(v) => updateViewState({ ignoreOtherTeams: v })}
            repos={availableRepos}
            selectedRepos={viewState.filterRepo}
            onRepoFilterChange={(v) => updateViewState({ filterRepo: v })}
          >
            <ColumnCustomizer columns={columnConfig} onColumnsChange={setColumnConfig} />
          </FilterBar>
        </div>
      )}
    </div>
  );
}

function groupByRepo(prs: PullRequest[]): PRGroup[] {
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

function groupByEpic(prs: PullRequest[]): PRGroup[] {
  const epicMap = new Map<string, { label: string; prs: PullRequest[] }>();
  const noEpic: PullRequest[] = [];
  for (const pr of prs) {
    const epic = pr.linkedJiraIssues[0];
    if (epic?.epicKey) {
      const key = epic.epicKey;
      const existing = epicMap.get(key);
      if (existing) {
        existing.prs.push(pr);
      } else {
        epicMap.set(key, {
          label: epic.epicSummary ? `${key}: ${epic.epicSummary}` : key,
          prs: [pr],
        });
      }
    } else {
      noEpic.push(pr);
    }
  }
  const groups: PRGroup[] = [...epicMap.entries()].map(([key, { label, prs: epicPRs }]) => ({
    id: key,
    label,
    prs: epicPRs,
    emptyMessage: `No PRs for ${key}`,
  }));
  if (noEpic.length > 0) {
    groups.push({ id: "no-epic", label: "No Epic", prs: noEpic, emptyMessage: "No PRs without an epic" });
  }
  return groups;
}

const JIRA_PRIORITY_ORDER = ["blocker", "critical", "major", "normal", "minor"];

function groupByJiraPriority(prs: PullRequest[]): PRGroup[] {
  const priorityMap = new Map<string, PullRequest[]>();
  const noPriority: PullRequest[] = [];
  for (const pr of prs) {
    const priority = pr.linkedJiraIssues[0]?.priority;
    if (priority?.name) {
      const key = priority.name;
      const list = priorityMap.get(key) ?? [];
      list.push(pr);
      priorityMap.set(key, list);
    } else {
      noPriority.push(pr);
    }
  }
  // Sort by known priority order, then any unknown ones alphabetically
  const sortedKeys = [...priorityMap.keys()].sort((a, b) => {
    const ai = JIRA_PRIORITY_ORDER.indexOf(a.toLowerCase());
    const bi = JIRA_PRIORITY_ORDER.indexOf(b.toLowerCase());
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });
  const groups: PRGroup[] = sortedKeys.map((key) => ({
    id: key,
    label: key,
    prs: priorityMap.get(key)!,
    emptyMessage: `No ${key} PRs`,
  }));
  if (noPriority.length > 0) {
    groups.push({ id: "no-priority", label: "No Jira Priority", prs: noPriority, emptyMessage: "No PRs without priority" });
  }
  return groups;
}

function groupByAction(prs: PullRequest[], reviewStatuses: Map<string, ReviewStatusResult>): PRGroup[] {
  const actionMap = new Map<string, PullRequest[]>();
  const noAction: PullRequest[] = [];
  for (const pr of prs) {
    const status = reviewStatuses.get(pr.id);
    const action = status?.action;
    if (action) {
      const list = actionMap.get(action) ?? [];
      list.push(pr);
      actionMap.set(action, list);
    } else {
      noAction.push(pr);
    }
  }
  // Sort by priority (lowest number first)
  const ACTION_ORDER = ["Address feedback", "Fix CI", "Re-review PR", "Review PR", "Complete work", "Merge PR"];
  const sortedKeys = [...actionMap.keys()].sort((a, b) => {
    const ai = ACTION_ORDER.indexOf(a);
    const bi = ACTION_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });
  const groups: PRGroup[] = sortedKeys.map((key) => ({
    id: key,
    label: key,
    prs: actionMap.get(key)!,
    emptyMessage: `No PRs needing "${key}"`,
  }));
  if (noAction.length > 0) {
    groups.push({ id: "no-action", label: "No Action Needed", prs: noAction, emptyMessage: "No PRs without actions" });
  }
  return groups;
}

function formatRelativeTime(isoString: string): string {
  const diffMs = new Date(isoString).getTime() - Date.now();
  if (diffMs <= 0) return "now";
  const mins = Math.ceil(diffMs / 60_000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

function LiveRelativeTime({ isoString }: { isoString: string }) {
  const format = useCallback(() => formatRelativeTime(isoString), [isoString]);
  const [text, setText] = useState(format);

  useEffect(() => {
    setText(format());
    const id = setInterval(() => setText(format()), 60_000);
    return () => clearInterval(id);
  }, [format]);

  return <>{text}</>;
}
