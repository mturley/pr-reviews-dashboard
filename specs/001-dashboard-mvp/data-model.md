# Data Model: PR Reviews Dashboard MVP

**Branch**: `001-dashboard-mvp` | **Date**: 2026-03-10

## Core Entities

### PullRequest

The primary entity in PR-primary views. Represents a GitHub pull request with optional Jira correlation.

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| id | `string` | GitHub | GraphQL node ID |
| number | `number` | GitHub | PR number |
| title | `string` | GitHub | |
| url | `string` | GitHub | HTML URL for linking |
| repoOwner | `string` | GitHub | Repository owner/org |
| repoName | `string` | GitHub | Repository name |
| author | `string` | GitHub | GitHub username |
| state | `"OPEN" \| "CLOSED" \| "MERGED"` | GitHub | |
| isDraft | `boolean` | GitHub | |
| isMergeable | `boolean \| null` | GitHub | null if unknown |
| createdAt | `string` | GitHub | ISO 8601 timestamp |
| updatedAt | `string` | GitHub | ISO 8601 timestamp |
| pushedAt | `string` | GitHub | Last push to PR branch |
| headRefOid | `string` | GitHub | HEAD commit SHA |
| labels | `string[]` | GitHub | Label names (for lgtm, approved detection) |
| reviews | `Review[]` | GitHub | Per-reviewer review details |
| reviewRequests | `string[]` | GitHub | Requested reviewer usernames |
| checkStatus | `CheckStatus` | GitHub | Combined CI status |
| linkedJiraIssues | `JiraIssueRef[]` | Jira | Populated during Jira cascade; empty array before Jira loads |

### Review

Per-reviewer review state on a pull request.

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| author | `string` | GitHub | Reviewer's GitHub username |
| state | `ReviewState` | GitHub | See enum below |
| submittedAt | `string` | GitHub | ISO 8601 timestamp |
| commitOid | `string` | GitHub | Commit SHA the review was submitted against |
| commentCount | `number` | GitHub | Number of inline comments in this review |

### ReviewState (enum)

```
"APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING"
```

### CheckStatus

Combined CI/check status for a PR's HEAD commit.

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| state | `"SUCCESS" \| "FAILURE" \| "PENDING" \| "ERROR" \| "EXPECTED" \| null` | GitHub | Rollup state |
| totalCount | `number` | GitHub | Total number of checks |
| successCount | `number` | GitHub | Checks that passed |
| failureCount | `number` | GitHub | Checks that failed |
| pendingCount | `number` | GitHub | Checks still running |

### JiraIssue

A Jira ticket with metadata. Primary entity in Jira-primary views (Sprint Status, Epic Status).

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| key | `string` | Jira | e.g. "RHOAIENG-12345" |
| url | `string` | Derived | `https://{JIRA_HOST}/browse/{key}` |
| type | `string` | Jira | e.g. "Bug", "Story", "Task" |
| typeIconUrl | `string` | Jira | URL to issue type icon |
| summary | `string` | Jira | Issue title |
| priority | `JiraPriority` | Jira | See below |
| state | `string` | Jira | Current status name (e.g. "In Progress", "Review") |
| assignee | `string \| null` | Jira | Jira display name |
| assigneeUsername | `string \| null` | Jira | Jira username |
| sprintName | `string \| null` | Jira | Current sprint name |
| sprintId | `number \| null` | Jira | Current sprint numeric ID |
| epicKey | `string \| null` | Jira | Parent epic issue key |
| storyPoints | `number \| null` | Jira | Current estimate |
| originalStoryPoints | `number \| null` | Jira | Original estimate |
| blocked | `boolean` | Jira | Whether issue is blocked |
| blockedReason | `string \| null` | Jira | Reason text when blocked |
| linkedPRUrls | `string[]` | Jira | Parsed from Git Pull Request custom field |
| linkedPRs | `PullRequestRef[]` | GitHub | Populated during GitHub cascade in Jira-primary views |

### JiraPriority

| Field | Type | Notes |
|-------|------|-------|
| id | `string` | Jira priority ID |
| name | `string` | e.g. "Blocker", "Critical", "Major", "Minor" |
| iconUrl | `string` | URL to priority icon |

### JiraIssueRef

Lightweight reference to a Jira issue, embedded in PullRequest for PR-primary views.

| Field | Type | Notes |
|-------|------|-------|
| key | `string` | Issue key |
| url | `string` | Browse URL |
| type | `string` | Issue type name |
| typeIconUrl | `string` | Issue type icon |
| priority | `JiraPriority` | |
| state | `string` | Current status |
| assignee | `string \| null` | Display name |

### PullRequestRef

Lightweight reference to a PR, embedded in JiraIssue for Jira-primary views.

| Field | Type | Notes |
|-------|------|-------|
| number | `number` | PR number |
| url | `string` | HTML URL |
| title | `string` | PR title |
| repoFullName | `string` | "owner/repo" |
| author | `string` | GitHub username |
| reviewStatus | `ReviewStatusResult` | Computed status |
| checkStatus | `CheckStatus` | CI status |

## Computed Types (View Layer)

### AuthorStatus (FR-041)

Status when the viewer is the PR author.

```
"New Feedback" | "Approved" | "Has LGTM" | "Awaiting Review" | "Draft"
```

### ReviewerStatus (FR-042)

Status when the viewer is not the PR author. Ordered by action priority.

```
"My Re-review Needed"         // P1
"Needs First Review"           // P2
"Team Re-review Needed"        // P3
"Needs Additional Review"      // P4
"Changes Requested (by others)" // P5
"My Changes Requested"         // no action priority
"Has LGTM"                     // no action priority
"Approved"                     // no action priority
"Draft"                        // no action priority
```

### ReviewStatusResult

The computed review status for a PR from a specific viewer's perspective.

| Field | Type | Notes |
|-------|------|-------|
| status | `AuthorStatus \| ReviewerStatus` | The status value |
| priority | `number \| null` | P1-P5 for actionable reviewer statuses, null otherwise |
| parenthetical | `string` | Context string, e.g. "2 new reviews since last push" |
| action | `string \| null` | Recommended action text, null for "Wait"/"No action" |
| reviewerBreakdown | `ReviewerBreakdownEntry[]` | For tooltip display |

### ReviewerBreakdownEntry

| Field | Type | Notes |
|-------|------|-------|
| username | `string` | Reviewer's GitHub username |
| state | `ReviewState` | Their latest review state |
| submittedAt | `string \| null` | When they last reviewed |
| hasNewCommitsSince | `boolean` | Whether PR has new commits since this review |

### RecommendedAction

An entry in the Recommended Actions panel.

| Field | Type | Notes |
|-------|------|-------|
| prUrl | `string` | Link to the PR |
| prTitle | `string` | PR title for display |
| repoName | `string` | Repository name |
| action | `string` | Action text from ReviewStatusResult |
| status | `AuthorStatus \| ReviewerStatus` | For visual indicator |
| priority | `number \| null` | P1-P5 action priority |
| jiraPriority | `JiraPriority \| null` | For sorting |
| prAge | `number` | Age in milliseconds for sorting |

### PRGroup

A group of PRs for the grouped table display.

| Field | Type | Notes |
|-------|------|-------|
| id | `string` | Group identifier |
| label | `string` | Display label (e.g. "My PRs", "PRs I'm Reviewing") |
| prs | `PullRequest[]` | PRs in this group |
| emptyMessage | `string` | Message when group has no PRs |

## Configuration Entities

### DashboardConfig

Persisted in local JSON config file.

| Field | Type | Notes |
|-------|------|-------|
| githubIdentity | `string` | User's GitHub username |
| jiraIdentity | `string` | User's Jira username |
| teamName | `string` | Display name for the team |
| githubOrgs | `string[]` | GitHub organizations to search |
| jiraProjectKey | `string` | e.g. "RHOAIENG" |
| jiraComponentName | `string` | e.g. "AI Core Dashboard" |
| sprintDiscoveryLabel | `string` | e.g. "dashboard-green-scrum" |
| teamMembers | `TeamMember[]` | Team roster |
| jiraFieldMapping | `JiraFieldMapping` | Custom field ID mapping |
| autoRefreshIntervalMs | `number` | Polling interval, default 300000 (5 min) |
| staleThresholdDays | `number` | Default stale PR cutoff |

### TeamMember

| Field | Type | Notes |
|-------|------|-------|
| displayName | `string` | Human-readable name |
| githubUsername | `string` | GitHub login |
| jiraUsername | `string` | Jira username |
| email | `string` | Email address |

### JiraFieldMapping

Maps semantic field names to Jira custom field IDs. Supports Datacenter → Cloud migration.

| Field | Type | Default (Datacenter) |
|-------|------|---------------------|
| gitPullRequest | `string` | `"customfield_12310220"` |
| sprint | `string` | `"customfield_12310940"` |
| storyPoints | `string` | `"customfield_12310243"` |
| originalStoryPoints | `string` | `"customfield_12314040"` |
| epicLink | `string` | `"customfield_12311140"` |
| blocked | `string` | `"customfield_12316543"` |
| blockedReason | `string` | `"customfield_12316544"` |

## Activity Entities

### ActivityEvent

A timestamped action from either GitHub or Jira.

| Field | Type | Notes |
|-------|------|-------|
| id | `string` | Unique identifier |
| source | `"github" \| "jira"` | Data source |
| timestamp | `string` | ISO 8601 |
| actor | `string` | Username of person who performed action |
| actorDisplayName | `string` | Human-readable name |
| actionType | `ActivityActionType` | See enum below |
| targetType | `"pr" \| "issue" \| "review" \| "comment"` | What was acted on |
| targetKey | `string` | PR URL or Jira issue key |
| targetTitle | `string` | PR title or issue summary |
| detail | `string \| null` | Additional context (e.g. "In Progress → Review") |

### ActivityActionType (enum)

```
// GitHub actions
"pr_opened" | "pr_merged" | "pr_closed" | "pr_reviewed" | "pr_commented" | "pr_pushed" |
// Jira actions
"issue_status_changed" | "issue_commented" | "issue_field_changed" | "issue_created"
```

## Entity Relationships

```
PullRequest 1──* Review                    (PR has many reviews)
PullRequest *──* JiraIssue                 (many-to-many via PR URLs in Jira field)
  └─ PR-primary view: PullRequest.linkedJiraIssues (JiraIssueRef[])
  └─ Jira-primary view: JiraIssue.linkedPRs (PullRequestRef[])
JiraIssue *──1 Sprint                      (issue belongs to one sprint)
JiraIssue *──1 Epic                        (issue linked to one epic via epicKey)
JiraIssue 1──* JiraIssue                   (epic has many child issues)
TeamMember 1──* PullRequest                (member authors many PRs)
DashboardConfig 1──* TeamMember            (config has many team members)
```

## State Transitions

### Review Status Computation Flow

```
Input: PullRequest + viewerGithubUsername
  │
  ├─ Is viewer the author? → Author Status (FR-041)
  │   ├─ PR is draft? → "Draft"
  │   ├─ Has lgtm + approved labels? → "Approved"
  │   ├─ Has lgtm label only? → "Has LGTM"
  │   ├─ Any reviews/comments since last push? → "New Feedback"
  │   └─ Otherwise → "Awaiting Review"
  │
  └─ Viewer is NOT the author? → Reviewer Status (FR-042)
      ├─ PR is draft? → "Draft"
      ├─ Has lgtm + approved labels? → "Approved"
      ├─ Has lgtm label only? → "Has LGTM"
      ├─ Viewer has reviewed + new commits since? → "My Re-review Needed" (P1)
      ├─ Viewer requested changes + no new push? → "My Changes Requested"
      ├─ No reviews from anyone? → "Needs First Review" (P2)
      ├─ Others reviewed + new commits since? → "Team Re-review Needed" (P3)
      ├─ Others reviewed (no viewer) + no new commits + no change requests? → "Needs Additional Review" (P4)
      ├─ Others requested changes + no new push? → "Changes Requested (by others)" (P5)
      └─ Otherwise → (fallback, should not occur with complete data)
```

### PR Group Assignment Flow (FR-014)

```
Input: PullRequest + viewerGithubUsername + sprintIssueKeys
  │
  ├─ PR author === viewer? → "My PRs" (highest priority)
  ├─ Viewer in PR reviewers/review requests? → "PRs I'm Reviewing"
  ├─ PR linked to sprint issue in Review state? → "Other PRs for [sprint] issues in Review"
  ├─ PR author is team member + no linked sprint issue? → "Other [team] PRs with No Jira"
  └─ Does not match any group → excluded from default view
```
