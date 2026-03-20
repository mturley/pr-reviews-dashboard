// useOverviewData hook — orchestrates all data for the Overview tab

import { useMemo, useCallback } from "react";
import { trpc } from "../trpc";
import { useProgressiveData, type LoadingPhase } from "./useProgressiveData";
import { computeReviewStatus } from "../../../server/src/logic/review-status";
import { deriveRecommendedActions } from "../../../server/src/logic/recommended-actions";
import { groupPRs } from "../../../server/src/logic/grouping";
import { isBot } from "@/lib/bot-users";
import type { PullRequest, ReviewStatusResult, RecommendedAction } from "../../../server/src/types/pr";
import type { JiraIssue } from "../../../server/src/types/jira";
import type { DashboardConfig } from "../../../server/src/types/config";

export interface OverviewDataResult {
  // PR data (from useProgressiveData)
  myPRs: PullRequest[];
  reviewingPRs: PullRequest[];
  reviewStatuses: Map<string, ReviewStatusResult>;
  actions: RecommendedAction[];

  // Jira overview data
  myEpics: JiraIssue[];
  myAssignedIssues: JiraIssue[];
  filterReviewIssues: JiraIssue[];
  filterTestingIssues: JiraIssue[];
  watchedIssues: JiraIssue[];

  // Linked PRs for overview Jira issues
  overviewLinkedPRs: PullRequest[];
  isOverviewPRsLoading: boolean;

  // Loading/error state
  phases: LoadingPhase[];
  isFetching: boolean;
  refetch: () => void;
  githubFetchedAt: string | null;
  jiraFetchedAt: string | null;
  overviewFetchedAt: string | null;
  githubError: Error | null;
  jiraError: Error | null;
  rateLimitRemaining: number | null;
  rateLimitResetAt: string | null;
  isGitHubLoading: boolean;
  isJiraLoading: boolean;
  sprintName: string | null;
}

export interface OverviewFilters {
  ignoreDrafts: boolean;
  ignoreOtherTeams: boolean;
  ignoreBots: boolean;
  filterActionNeeded: boolean;
}

export function useOverviewData(options: {
  refetchInterval?: number | false;
  config?: DashboardConfig;
  filters: OverviewFilters;
  teamMemberUsernames: string[];
}): OverviewDataResult {
  const { config, refetchInterval, filters, teamMemberUsernames } = options;
  const viewer = config?.githubIdentity ?? "";
  const accountId = config?.jiraAccountId ?? "";
  const filterId = config?.teamAreaLabelsFilter ?? null;

  // Reuse progressive data for GitHub PRs + Jira sprint
  const progressiveData = useProgressiveData({ refetchInterval });

  // Overview-specific Jira queries
  const myIssuesQuery = trpc.jira.getMyIssues.useQuery(undefined, {
    refetchInterval,
    enabled: !!accountId,
  });

  const filterIssuesQuery = trpc.jira.getFilterIssues.useQuery(
    { filterId: filterId! },
    { refetchInterval, enabled: filterId != null },
  );

  const watchedIssuesQuery = trpc.jira.getWatchedIssues.useQuery(undefined, {
    refetchInterval,
    enabled: !!accountId,
  });

  // Split PRs into my PRs vs reviewing
  const { myPRs, reviewingPRs } = useMemo(() => {
    const mine: PullRequest[] = [];
    const reviewing: PullRequest[] = [];
    for (const pr of progressiveData.prs) {
      if (pr.author === viewer) {
        mine.push(pr);
      } else if (
        pr.reviews.some((r) => r.author === viewer) ||
        pr.mentionedUsers.includes(viewer)
      ) {
        reviewing.push(pr);
      }
    }
    return { myPRs: mine, reviewingPRs: reviewing };
  }, [progressiveData.prs, viewer]);

  // Compute review statuses for all PRs
  const reviewStatuses = useMemo(() => {
    const map = new Map<string, ReviewStatusResult>();
    if (!viewer) return map;
    for (const pr of progressiveData.prs) {
      map.set(pr.id, computeReviewStatus(pr, viewer));
    }
    return map;
  }, [progressiveData.prs, viewer]);

  // Apply filters to PRs before computing actions (matches /reviews tab behavior)
  const filteredPRs = useMemo(() => {
    let prs = progressiveData.prs;
    if (filters.ignoreDrafts) prs = prs.filter((pr) => !pr.isDraft);
    if (filters.ignoreBots) prs = prs.filter((pr) => !isBot(pr.author));
    if (filters.ignoreOtherTeams && teamMemberUsernames.length > 0) {
      const teamSet = new Set(teamMemberUsernames.map((u) => u.toLowerCase()));
      // Keep PRs authored by team members OR authored by the viewer
      prs = prs.filter((pr) => pr.author === viewer || teamSet.has(pr.author.toLowerCase()));
    }
    return prs;
  }, [progressiveData.prs, filters.ignoreDrafts, filters.ignoreBots, filters.ignoreOtherTeams, teamMemberUsernames, viewer]);

  // Use groupPRs to get all 4 groups (matches /reviews tab)
  const allActionPRs = useMemo(() => {
    const groups = groupPRs(filteredPRs, {
      viewerGithubUsername: viewer,
      teamMembers: teamMemberUsernames,
      sprintName: progressiveData.sprintName ?? undefined,
    });
    return groups.flatMap((g) => g.prs);
  }, [filteredPRs, viewer, teamMemberUsernames, progressiveData.sprintName]);

  const actions = useMemo(
    () => deriveRecommendedActions(allActionPRs, reviewStatuses),
    [allActionPRs, reviewStatuses],
  );

  // Split my issues into epics vs non-epics
  const { myEpics, myAssignedIssues } = useMemo(() => {
    const issues = myIssuesQuery.data?.issues ?? [];
    const epics: JiraIssue[] = [];
    const nonEpics: JiraIssue[] = [];
    for (const issue of issues) {
      if (issue.type.toLowerCase() === "epic") {
        epics.push(issue);
      } else {
        nonEpics.push(issue);
      }
    }
    return { myEpics: epics, myAssignedIssues: nonEpics };
  }, [myIssuesQuery.data]);

  // Split filter issues into Review vs Testing, excluding issues assigned to me
  const { filterReviewIssues, filterTestingIssues } = useMemo(() => {
    const issues = filterIssuesQuery.data?.issues ?? [];
    const myKeys = new Set([
      ...myEpics.map((i) => i.key),
      ...myAssignedIssues.map((i) => i.key),
    ]);
    const review: JiraIssue[] = [];
    const testing: JiraIssue[] = [];
    for (const issue of issues) {
      if (myKeys.has(issue.key)) continue;
      if (issue.type.toLowerCase() === "epic") continue;
      const state = issue.state.toLowerCase();
      if (state.includes("review")) {
        review.push(issue);
      } else if (state.includes("testing") || state.includes("test")) {
        testing.push(issue);
      }
    }
    return { filterReviewIssues: review, filterTestingIssues: testing };
  }, [filterIssuesQuery.data, myEpics, myAssignedIssues]);

  // Watched issues: exclude everything already shown in other cards
  const watchedIssues = useMemo(() => {
    const issues = watchedIssuesQuery.data?.issues ?? [];
    const shownKeys = new Set([
      ...myEpics.map((i) => i.key),
      ...myAssignedIssues.map((i) => i.key),
      ...filterReviewIssues.map((i) => i.key),
      ...filterTestingIssues.map((i) => i.key),
    ]);
    return issues.filter((i) => !shownKeys.has(i.key) && i.type.toLowerCase() !== "epic");
  }, [watchedIssuesQuery.data, myEpics, myAssignedIssues, filterReviewIssues, filterTestingIssues]);

  // Collect all linked PR URLs from overview Jira issues for enrichment
  const overviewPRUrls = useMemo(() => {
    const allIssues = [...myEpics, ...myAssignedIssues, ...filterReviewIssues, ...filterTestingIssues, ...watchedIssues];
    const knownUrls = new Set(progressiveData.prs.map((pr) => pr.url.replace(/\/$/, "")));
    const urls: string[] = [];
    for (const issue of allIssues) {
      for (const url of issue.linkedPRUrls) {
        const normalized = url.replace(/\/$/, "");
        if (!knownUrls.has(normalized) && !urls.includes(normalized)) {
          urls.push(normalized);
        }
      }
    }
    return urls;
  }, [myEpics, myAssignedIssues, filterReviewIssues, filterTestingIssues, watchedIssues, progressiveData.prs]);

  const overviewPRsQuery = trpc.github.getPRsByUrls.useQuery(
    { prUrls: overviewPRUrls },
    { enabled: overviewPRUrls.length > 0 },
  );

  // Merge progressive PRs + overview-fetched PRs for linking
  const overviewLinkedPRs = useMemo(() => {
    const all = [...progressiveData.prs, ...(overviewPRsQuery.data?.prs ?? [])];
    // Deduplicate by URL
    const seen = new Set<string>();
    return all.filter((pr) => {
      const normalized = pr.url.replace(/\/$/, "");
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }, [progressiveData.prs, overviewPRsQuery.data]);

  // Build loading phases
  const overviewPhases: LoadingPhase[] = useMemo(() => {
    const myPhase: LoadingPhase = {
      label: "My Issues",
      status: myIssuesQuery.isFetching ? "active"
        : myIssuesQuery.isError ? "error"
        : myIssuesQuery.isSuccess ? "done"
        : !accountId ? "skipped" : "pending",
      detail: myIssuesQuery.isSuccess
        ? `${myIssuesQuery.data.issues.length} issues`
        : myIssuesQuery.error?.message,
    };

    const filterPhase: LoadingPhase = {
      label: "Team Filter",
      status: filterId == null ? "skipped"
        : filterIssuesQuery.isFetching ? "active"
        : filterIssuesQuery.isError ? "error"
        : filterIssuesQuery.isSuccess ? "done" : "pending",
      detail: filterId == null
        ? "No filter configured"
        : filterIssuesQuery.isSuccess
        ? `${filterIssuesQuery.data.issues.length} issues`
        : filterIssuesQuery.error?.message,
    };

    const watchedPhase: LoadingPhase = {
      label: "Watched Issues",
      status: watchedIssuesQuery.isFetching ? "active"
        : watchedIssuesQuery.isError ? "error"
        : watchedIssuesQuery.isSuccess ? "done"
        : !accountId ? "skipped" : "pending",
      detail: watchedIssuesQuery.isSuccess
        ? `${watchedIssuesQuery.data.issues.length} issues`
        : watchedIssuesQuery.error?.message,
    };

    return [myPhase, filterPhase, watchedPhase];
  }, [
    accountId, filterId,
    myIssuesQuery.isFetching, myIssuesQuery.isError, myIssuesQuery.isSuccess,
    myIssuesQuery.data, myIssuesQuery.error,
    filterIssuesQuery.isFetching, filterIssuesQuery.isError, filterIssuesQuery.isSuccess,
    filterIssuesQuery.data, filterIssuesQuery.error,
    watchedIssuesQuery.isFetching, watchedIssuesQuery.isError, watchedIssuesQuery.isSuccess,
    watchedIssuesQuery.data, watchedIssuesQuery.error,
  ]);

  const allPhases = [...progressiveData.phases, ...overviewPhases];

  const refetch = useCallback(() => {
    progressiveData.refetch();
    myIssuesQuery.refetch();
    if (filterId != null) filterIssuesQuery.refetch();
    watchedIssuesQuery.refetch();
    if (overviewPRUrls.length > 0) overviewPRsQuery.refetch();
  }, [progressiveData, myIssuesQuery, filterIssuesQuery, watchedIssuesQuery, overviewPRsQuery, filterId, overviewPRUrls.length]);

  const overviewFetchedAt = myIssuesQuery.data?.fetchedAt
    ?? filterIssuesQuery.data?.fetchedAt
    ?? watchedIssuesQuery.data?.fetchedAt
    ?? null;

  return {
    myPRs,
    reviewingPRs,
    reviewStatuses,
    actions,
    myEpics,
    myAssignedIssues,
    filterReviewIssues,
    filterTestingIssues,
    watchedIssues,
    overviewLinkedPRs,
    isOverviewPRsLoading: overviewPRsQuery.isFetching,
    phases: allPhases,
    isFetching: progressiveData.isFetching || myIssuesQuery.isFetching || filterIssuesQuery.isFetching || watchedIssuesQuery.isFetching || overviewPRsQuery.isFetching,
    refetch,
    githubFetchedAt: progressiveData.githubFetchedAt,
    jiraFetchedAt: progressiveData.jiraFetchedAt,
    overviewFetchedAt,
    githubError: progressiveData.githubError,
    jiraError: progressiveData.jiraError,
    rateLimitRemaining: progressiveData.rateLimitRemaining,
    rateLimitResetAt: progressiveData.rateLimitResetAt,
    isGitHubLoading: progressiveData.isGitHubLoading,
    isJiraLoading: progressiveData.isJiraLoading,
    sprintName: progressiveData.sprintName,
  };
}
