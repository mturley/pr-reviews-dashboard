// T028: PR grouping logic (4 default groups with priority-based dedup per FR-014)

import type { PullRequest, PRGroup } from "../types/pr.js";

export interface GroupingContext {
  viewerGithubUsername: string;
  teamMembers: string[];
  sprintIssueKeys?: string[];
  sprintName?: string;
}

export function groupPRs(prs: PullRequest[], ctx: GroupingContext): PRGroup[] {
  const assigned = new Set<string>();

  const myPRs: PullRequest[] = [];
  const reviewing: PullRequest[] = [];
  const sprintReview: PullRequest[] = [];
  const noJira: PullRequest[] = [];

  // Priority-based dedup: each PR goes into the highest-priority group it matches
  for (const pr of prs) {
    // Group 1: My PRs (highest priority)
    if (pr.author === ctx.viewerGithubUsername) {
      myPRs.push(pr);
      assigned.add(pr.id);
      continue;
    }

    // Group 2: PRs I'm Reviewing
    const isReviewer =
      pr.reviewRequests.includes(ctx.viewerGithubUsername) ||
      pr.reviews.some((r) => r.author === ctx.viewerGithubUsername);
    if (isReviewer) {
      reviewing.push(pr);
      assigned.add(pr.id);
      continue;
    }

    // Group 3: Sprint Review PRs (PRs linked to sprint issues in Review state)
    // This requires Jira data — PRs with linked sprint issues go here
    const hasSprintJiraLink = pr.linkedJiraIssues.some(
      (j) => j.state.toLowerCase().includes("review"),
    );
    if (hasSprintJiraLink) {
      sprintReview.push(pr);
      assigned.add(pr.id);
      continue;
    }

    // Group 4: Team PRs with no Jira
    const isTeamMember = ctx.teamMembers.includes(pr.author);
    if (isTeamMember && pr.linkedJiraIssues.length === 0) {
      noJira.push(pr);
      assigned.add(pr.id);
    }
  }

  const sprintLabel = ctx.sprintName ?? "Sprint";

  return [
    {
      id: "my-prs",
      label: "My PRs",
      prs: myPRs,
      emptyMessage: "You have no open PRs",
    },
    {
      id: "reviewing",
      label: "PRs I'm Reviewing",
      prs: reviewing,
      emptyMessage: "No PRs to review",
    },
    {
      id: "sprint-review",
      label: `Other PRs for ${sprintLabel} issues in Review`,
      prs: sprintReview,
      emptyMessage: "No other PRs for Jira issues in Review state",
    },
    {
      id: "no-jira",
      label: `Other ${ctx.viewerGithubUsername ? "team" : ""} PRs with No Jira`,
      prs: noJira,
      emptyMessage: "No unlinked PRs",
    },
  ];
}
