// Activity types per data-model.md (used in Phase 10)

export type ActivityActionType =
  // GitHub actions
  | "pr_opened"
  | "pr_merged"
  | "pr_closed"
  | "pr_reviewed"
  | "pr_commented"
  | "pr_pushed"
  // Jira actions
  | "issue_status_changed"
  | "issue_commented"
  | "issue_field_changed"
  | "issue_created";

export interface ActivityEvent {
  id: string;
  source: "github" | "jira";
  timestamp: string;
  actor: string;
  actorDisplayName: string;
  actionType: ActivityActionType;
  targetType: "pr" | "issue" | "review" | "comment";
  targetKey: string;
  targetTitle: string;
  detail: string | null;
  // Optional metadata for richer display
  jiraTypeIconUrl?: string | null;
  jiraType?: string | null;
  epicKey?: string | null;
  epicSummary?: string | null;
  epicUrl?: string | null;
  prState?: "OPEN" | "MERGED" | "CLOSED" | "DRAFT" | null;
  prAuthor?: string | null;
}
