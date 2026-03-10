// T009: Core PR types per data-model.md
// T012: Computed review status types per data-model.md

export type ReviewState = "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING";

export interface Review {
  author: string;
  state: ReviewState;
  submittedAt: string;
  commitOid: string;
  commentCount: number;
}

export interface CheckStatus {
  state: "SUCCESS" | "FAILURE" | "PENDING" | "ERROR" | "EXPECTED" | null;
  totalCount: number;
  successCount: number;
  failureCount: number;
  pendingCount: number;
}

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  url: string;
  repoOwner: string;
  repoName: string;
  author: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  isDraft: boolean;
  isMergeable: boolean | null;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  headRefOid: string;
  labels: string[];
  reviews: Review[];
  reviewRequests: string[];
  checkStatus: CheckStatus;
  linkedJiraIssues: JiraIssueRef[];
}

// Lightweight reference embedded in PullRequest for PR-primary views
export interface JiraIssueRef {
  key: string;
  url: string;
  type: string;
  typeIconUrl: string;
  priority: JiraPriority;
  state: string;
  assignee: string | null;
  blocked: boolean;
}

export interface JiraPriority {
  id: string;
  name: string;
  iconUrl: string;
}

// Computed types (view layer)

export type AuthorStatus =
  | "New Feedback"
  | "Approved"
  | "Has LGTM"
  | "Awaiting Review"
  | "Draft";

export type ReviewerStatus =
  | "My Re-review Needed"
  | "Needs First Review"
  | "Team Re-review Needed"
  | "Needs Additional Review"
  | "Changes Requested (by others)"
  | "My Changes Requested"
  | "Has LGTM"
  | "Approved"
  | "Draft";

export interface ReviewerBreakdownEntry {
  username: string;
  state: ReviewState;
  submittedAt: string | null;
  hasNewCommitsSince: boolean;
}

export interface ReviewStatusResult {
  status: AuthorStatus | ReviewerStatus;
  priority: number | null;
  parenthetical: string;
  action: string | null;
  reviewerBreakdown: ReviewerBreakdownEntry[];
}

export interface RecommendedAction {
  prUrl: string;
  prTitle: string;
  repoName: string;
  action: string;
  status: AuthorStatus | ReviewerStatus;
  priority: number | null;
  jiraPriority: JiraPriority | null;
  prAge: number;
}

export interface PRGroup {
  id: string;
  label: string;
  prs: PullRequest[];
  emptyMessage: string;
}

// Lightweight reference embedded in JiraIssue for Jira-primary views
export interface PullRequestRef {
  number: number;
  url: string;
  title: string;
  repoFullName: string;
  author: string;
  reviewStatus: ReviewStatusResult;
  checkStatus: CheckStatus;
}
