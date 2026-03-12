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

// Sub-priority within the same action priority level (lower = higher priority).
// "Needs First Review" ranks above "Team Re-review Needed" when all else is equal.
const STATUS_SUB_PRIORITY: Record<string, number> = {
  "Needs First Review": 0,
  "I'm mentioned": 1,
  "Team Re-review Needed": 2,
  "Needs Additional Review": 3,
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
      reviewerBreakdown: status.reviewerBreakdown,
      pushedAt: status.pushedAt,
      pushDates: status.pushDates,
    });
  }

  // Sort by: action priority (P1-P5), then status sub-priority, then Jira priority, then PR age (oldest first)
  actions.sort((a, b) => {
    // Action priority (lower is higher priority)
    const aPrio = a.priority ?? 99;
    const bPrio = b.priority ?? 99;
    if (aPrio !== bPrio) return aPrio - bPrio;

    // Sub-priority within the same action priority level
    const aSubPrio = STATUS_SUB_PRIORITY[a.status] ?? 99;
    const bSubPrio = STATUS_SUB_PRIORITY[b.status] ?? 99;
    if (aSubPrio !== bSubPrio) return aSubPrio - bSubPrio;

    // Jira priority
    const NO_JIRA_DEFAULT = JIRA_PRIORITY_ORDER.Normal;
    const aJira = a.jiraPriority ? (JIRA_PRIORITY_ORDER[a.jiraPriority.name] ?? NO_JIRA_DEFAULT) : NO_JIRA_DEFAULT;
    const bJira = b.jiraPriority ? (JIRA_PRIORITY_ORDER[b.jiraPriority.name] ?? NO_JIRA_DEFAULT) : NO_JIRA_DEFAULT;
    if (aJira !== bJira) return aJira - bJira;

    // PR age (oldest first = largest age first)
    return b.prAge - a.prAge;
  });

  return actions;
}
