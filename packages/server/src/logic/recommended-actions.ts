// T045: Recommended actions derivation from review status

import type { PullRequest, ReviewStatusResult, RecommendedAction } from "../types/pr.js";

const JIRA_PRIORITY_ORDER: Record<string, number> = {
  Blocker: 0,
  Critical: 1,
  Major: 2,
  Normal: 3,
  Minor: 4,
  Trivial: 5,
};

export function deriveRecommendedActions(
  prs: PullRequest[],
  reviewStatuses: Map<string, ReviewStatusResult>,
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];

  for (const pr of prs) {
    const status = reviewStatuses.get(pr.id);
    if (!status || !status.action) continue;

    const jiraIssue = pr.linkedJiraIssues[0] ?? null;
    actions.push({
      prUrl: pr.url,
      prTitle: pr.title,
      repoName: `${pr.repoOwner}/${pr.repoName}`,
      author: pr.author,
      action: status.action,
      status: status.status,
      parenthetical: status.parenthetical,
      hasCIFailure: pr.checkStatus.state === "FAILURE" || pr.checkStatus.state === "ERROR",
      priority: status.priority,
      jiraPriority: jiraIssue?.priority ?? null,
      prAge: Date.now() - new Date(pr.createdAt).getTime(),
      createdAt: pr.createdAt,
      updatedAt: pr.updatedAt,
      jiraKey: jiraIssue?.key ?? null,
      jiraUrl: jiraIssue?.url ?? null,
      jiraSummary: jiraIssue?.summary ?? null,
      jiraTypeIconUrl: jiraIssue?.typeIconUrl ?? null,
      epicKey: jiraIssue?.epicKey ?? null,
      epicSummary: jiraIssue?.epicSummary ?? null,
    });
  }

  // Sort by: action priority (P1-P5), then Jira priority, then PR age (oldest first)
  actions.sort((a, b) => {
    // Action priority (lower is higher priority)
    const aPrio = a.priority ?? 99;
    const bPrio = b.priority ?? 99;
    if (aPrio !== bPrio) return aPrio - bPrio;

    // Jira priority
    const aJira = a.jiraPriority ? (JIRA_PRIORITY_ORDER[a.jiraPriority.name] ?? 99) : 99;
    const bJira = b.jiraPriority ? (JIRA_PRIORITY_ORDER[b.jiraPriority.name] ?? 99) : 99;
    if (aJira !== bJira) return aJira - bJira;

    // PR age (oldest first = largest age first)
    return b.prAge - a.prAge;
  });

  return actions;
}
