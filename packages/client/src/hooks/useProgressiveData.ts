// T042: useProgressiveData hook — orchestrates 3-phase cascade

import { useMemo } from "react";
import { trpc } from "../trpc";
import type { PullRequest, JiraIssueRef } from "../../../server/src/types/pr";
import type { JiraIssue } from "../../../server/src/types/jira";

function correlatePRsWithJira(prs: PullRequest[], jiraIssues: JiraIssue[]): PullRequest[] {
  const urlToJiraRefs = new Map<string, JiraIssueRef[]>();
  for (const issue of jiraIssues) {
    const ref: JiraIssueRef = {
      key: issue.key,
      url: issue.url,
      type: issue.type,
      typeIconUrl: issue.typeIconUrl,
      priority: issue.priority,
      state: issue.state,
      assignee: issue.assignee,
      blocked: issue.blocked,
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

export interface ProgressiveDataResult {
  prs: PullRequest[];
  isGitHubLoading: boolean;
  isJiraLoading: boolean;
  isCascadeLoading: boolean;
  githubError: Error | null;
  jiraError: Error | null;
  githubFetchedAt: string | null;
  jiraFetchedAt: string | null;
  rateLimitRemaining: number | null;
  sprintName: string | null;
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
    const cascadePRs = cascadeQuery.data?.prs ?? [];
    const allPRs = [...basePRs, ...cascadePRs];

    if (jiraQuery.data) {
      return correlatePRsWithJira(allPRs, jiraQuery.data.issues);
    }
    return allPRs;
  }, [teamPRsQuery.data, cascadeQuery.data, jiraQuery.data]);

  return {
    prs,
    isGitHubLoading: teamPRsQuery.isLoading,
    isJiraLoading: jiraQuery.isLoading,
    isCascadeLoading: cascadeQuery.isLoading,
    githubError: teamPRsQuery.error as Error | null,
    jiraError: jiraQuery.error as Error | null,
    githubFetchedAt: teamPRsQuery.data?.fetchedAt ?? null,
    jiraFetchedAt: jiraQuery.data?.fetchedAt ?? null,
    rateLimitRemaining: teamPRsQuery.data?.rateLimitRemaining ?? null,
    sprintName: jiraQuery.data?.sprintName ?? null,
  };
}
