// T009: Core PR types per data-model.md
// T012: Computed review status types per data-model.md

export type ReviewState = "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING";

export interface Review {
  databaseId: number | null;
  author: string;
  state: ReviewState;
  submittedAt: string;
  commitOid: string;
  commentCount: number;
  body: string;
}

export interface PRComment {
  author: string;
  createdAt: string;
  body: string;
}

export interface CheckStatus {
  state: "SUCCESS" | "FAILURE" | "PENDING" | "ERROR" | "EXPECTED" | null;
  totalCount: number;
  successCount: number;
  failureCount: number;
  pendingCount: number;
}

export interface CommitInfo {
  oid: string;
  message: string;
  pushedDate: string;
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
  pushDates: string[];
  commits: CommitInfo[];
  headRefOid: string;
  labels: string[];
  reviews: Review[];
  comments: PRComment[];
  reviewRequests: string[];
  mentionedUsers: string[];
  checkStatus: CheckStatus;
  linkedJiraIssues: JiraIssueRef[];
}

// Lightweight reference embedded in PullRequest for PR-primary views
export interface JiraIssueRef {
  key: string;
  url: string;
  summary: string;
  type: string;
  typeIconUrl: string;
  priority: JiraPriority;
  state: string;
  assignee: string | null;
  blocked: boolean;
  epicKey: string | null;
  epicSummary: string | null;
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
  | "WIP"
  | "Merged";

export type ReviewerStatus =
  | "My Re-review Needed"
  | "Needs First Review"
  | "I'm mentioned"
  | "Team Re-review Needed"
  | "Needs Additional Review"
  | "Awaiting Changes"
  | "Has LGTM"
  | "Approved"
  | "WIP"
  | "Merged";

export type CommentAction = "LGTM" | "APPROVE" | "COMMENT";

export interface ReviewerBreakdownEntry {
  username: string;
  state: ReviewState;
  submittedAt: string | null;
  hasNewCommitsSince: boolean;
  source: "review" | "comment";
  commentAction?: CommentAction;
}

export interface ReviewStatusResult {
  status: AuthorStatus | ReviewerStatus;
  priority: number | null;
  parenthetical: string;
  action: string | null;
  reviewerBreakdown: ReviewerBreakdownEntry[];
  pushedAt?: string;
  pushDates?: string[];
}

export interface RecommendedAction {
  prUrl: string;
  prTitle: string;
  repoName: string;
  author: string;
  action: string;
  status: AuthorStatus | ReviewerStatus;
  parenthetical: string;
  hasCIFailure: boolean;
  priority: number | null;
  jiraPriority: JiraPriority | null;
  prAge: number;
  createdAt: string;
  updatedAt: string;
  jiraKey: string | null;
  jiraUrl: string | null;
  jiraSummary: string | null;
  jiraTypeIconUrl: string | null;
  epicKey: string | null;
  epicSummary: string | null;
  reviewerBreakdown: ReviewerBreakdownEntry[];
  pushedAt?: string;
  pushDates?: string[];
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
  state: "OPEN" | "CLOSED" | "MERGED";
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
  reviewStatus: ReviewStatusResult;
  checkStatus: CheckStatus;
}
