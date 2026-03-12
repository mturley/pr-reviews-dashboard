// T042: useProgressiveData hook — orchestrates 3-phase cascade

import { useMemo, useCallback } from "react";
import { trpc } from "../trpc";
import type { PullRequest, JiraIssueRef } from "../../../server/src/types/pr";
import type { JiraIssue } from "../../../server/src/types/jira";

interface ErrorWithRateLimit {
  data?: { rateLimit?: { remaining: number; limit: number; resetAt: string } };
}

function correlatePRsWithJira(prs: PullRequest[], jiraIssues: JiraIssue[]): PullRequest[] {
  // Match by PR URL in Jira's Git Pull Request field
  const urlToJiraRefs = new Map<string, JiraIssueRef[]>();
  for (const issue of jiraIssues) {
    const ref: JiraIssueRef = {
      key: issue.key,
      url: issue.url,
      summary: issue.summary,
      type: issue.type,
      typeIconUrl: issue.typeIconUrl,
      priority: issue.priority,
      state: issue.state,
      assignee: issue.assignee,
      blocked: issue.blocked,
      epicKey: issue.epicKey,
      epicSummary: issue.epicSummary,
    };
    for (const prUrl of issue.linkedPRUrls) {
      const normalized = prUrl.replace(/\/$/, "");
      const existing = urlToJiraRefs.get(normalized) ?? [];
      existing.push(ref);
      urlToJiraRefs.set(normalized, existing);
    }
  }

  return prs.map((pr) => {
    const normalized = pr.url.replace(/\/$/, "");
    const linked = urlToJiraRefs.get(normalized) ?? [];
    return linked.length > 0 ? { ...pr, linkedJiraIssues: linked } : pr;
  });
}

export type PhaseStatus = "pending" | "active" | "done" | "error" | "skipped";

export interface LoadingPhase {
  label: string;
  status: PhaseStatus;
  detail?: string;
}

export interface ProgressiveDataResult {
  prs: PullRequest[];
  isGitHubLoading: boolean;
  isJiraLoading: boolean;
  isCascadeLoading: boolean;
  githubError: Error | null;
  jiraError: Error | null;
  githubFetchedAt: string | null;
  jiraFetchedAt: string | null;
  isFetching: boolean;
  refetch: () => void;
  rateLimitRemaining: number | null;
  rateLimitLimit: number | null;
  rateLimitResetAt: string | null;
  sprintName: string | null;
  sprintId: number | null;
  sprintUrl: string | null;
  phases: LoadingPhase[];
}

export function useProgressiveData(
  options: { refetchInterval?: number | false } = {},
): ProgressiveDataResult {
  // Phase 1: GitHub data (immediate)
  const teamPRsQuery = trpc.github.getTeamPRs.useQuery(undefined, {
    refetchInterval: options.refetchInterval,
  });

  // Phase 2: Jira data (after GitHub succeeds)
  const jiraQuery = trpc.jira.getSprintIssues.useQuery(undefined, {
    enabled: teamPRsQuery.isSuccess,
    refetchInterval: options.refetchInterval,
  });

  // Phase 3: Cascade — find PR URLs from Jira that aren't in Phase 1
  const cascadePRUrls = useMemo(() => {
    if (!teamPRsQuery.data || !jiraQuery.data) return [];
    const knownUrls = new Set(teamPRsQuery.data.prs.map((pr) => pr.url.replace(/\/$/, "")));
    const newUrls: string[] = [];
    for (const issue of jiraQuery.data.issues) {
      for (const url of issue.linkedPRUrls) {
        const normalized = url.replace(/\/$/, "");
        if (!knownUrls.has(normalized) && !newUrls.includes(normalized)) {
          newUrls.push(normalized);
        }
      }
    }
    return newUrls;
  }, [teamPRsQuery.data, jiraQuery.data]);

  const cascadeQuery = trpc.github.getPRsByUrls.useQuery(
    { prUrls: cascadePRUrls },
    { enabled: cascadePRUrls.length > 0 },
  );

  // Merge all PRs and correlate with Jira
  const prs = useMemo(() => {
    const basePRs = teamPRsQuery.data?.prs ?? [];
    // Cascade PRs come from Jira links and may include merged/closed PRs — filter to open only
    const cascadePRs = (cascadeQuery.data?.prs ?? []).filter((pr) => pr.state === "OPEN");
    const allPRs = [...basePRs, ...cascadePRs];

    if (jiraQuery.data) {
      return correlatePRsWithJira(allPRs, jiraQuery.data.issues);
    }
    return allPRs;
  }, [teamPRsQuery.data, cascadeQuery.data, jiraQuery.data]);

  const refetch = useCallback(() => {
    teamPRsQuery.refetch();
    jiraQuery.refetch();
    cascadeQuery.refetch();
  }, [teamPRsQuery, jiraQuery, cascadeQuery]);

  const phases: LoadingPhase[] = useMemo(() => {
    const githubPhase: LoadingPhase = {
      label: "GitHub PRs",
      status: teamPRsQuery.isFetching ? "active"
        : teamPRsQuery.isError ? "error"
        : teamPRsQuery.isSuccess ? "done" : "pending",
      detail: teamPRsQuery.isSuccess
        ? `${teamPRsQuery.data.prs.length} PRs found`
        : teamPRsQuery.error?.message,
    };

    const jiraPhase: LoadingPhase = {
      label: "Jira Sprint",
      status: !teamPRsQuery.isSuccess ? "pending"
        : jiraQuery.isFetching ? "active"
        : jiraQuery.isError ? "error"
        : jiraQuery.isSuccess ? "done" : "pending",
      detail: jiraQuery.isSuccess
        ? `${jiraQuery.data.issues.length} issues — ${jiraQuery.data.sprintName}`
        : jiraQuery.error?.message,
    };

    const cascadePhase: LoadingPhase = {
      label: "Linked PRs",
      status: cascadePRUrls.length === 0 && jiraQuery.isSuccess ? "skipped"
        : !jiraQuery.isSuccess ? "pending"
        : cascadeQuery.isFetching ? "active"
        : cascadeQuery.isSuccess ? "done" : "pending",
      detail: cascadePRUrls.length === 0 && jiraQuery.isSuccess
        ? "No additional PRs to fetch"
        : cascadeQuery.isSuccess
        ? `${cascadeQuery.data.prs.length} additional PRs`
        : undefined,
    };

    return [githubPhase, jiraPhase, cascadePhase];
  }, [
    teamPRsQuery.isFetching, teamPRsQuery.isError, teamPRsQuery.isSuccess,
    teamPRsQuery.data, teamPRsQuery.error,
    jiraQuery.isFetching, jiraQuery.isError, jiraQuery.isSuccess,
    jiraQuery.data, jiraQuery.error,
    cascadePRUrls.length,
    cascadeQuery.isFetching, cascadeQuery.isSuccess, cascadeQuery.data,
  ]);

  return {
    prs,
    isGitHubLoading: teamPRsQuery.isLoading,
    isJiraLoading: jiraQuery.isLoading,
    isCascadeLoading: cascadeQuery.isLoading,
    isFetching: teamPRsQuery.isFetching || jiraQuery.isFetching || cascadeQuery.isFetching,
    refetch,
    githubError: teamPRsQuery.error as Error | null,
    jiraError: jiraQuery.error as Error | null,
    githubFetchedAt: teamPRsQuery.data?.fetchedAt ?? null,
    jiraFetchedAt: jiraQuery.data?.fetchedAt ?? null,
    rateLimitRemaining: teamPRsQuery.data?.rateLimitRemaining
      ?? (teamPRsQuery.error as ErrorWithRateLimit | null)?.data?.rateLimit?.remaining
      ?? null,
    rateLimitLimit: teamPRsQuery.data?.rateLimitLimit
      ?? (teamPRsQuery.error as ErrorWithRateLimit | null)?.data?.rateLimit?.limit
      ?? null,
    rateLimitResetAt: teamPRsQuery.data?.rateLimitResetAt
      ?? (teamPRsQuery.error as ErrorWithRateLimit | null)?.data?.rateLimit?.resetAt
      ?? null,
    sprintName: jiraQuery.data?.sprintName ?? null,
    sprintId: jiraQuery.data?.sprintId ?? null,
    sprintUrl: jiraQuery.data?.sprintUrl ?? null,
    phases,
  };
}
