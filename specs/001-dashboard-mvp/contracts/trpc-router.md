# tRPC Router Contract: PR Reviews Dashboard MVP

**Branch**: `001-dashboard-mvp` | **Date**: 2026-03-10

This document defines the tRPC router structure — the API contract between the client and server. All procedures are type-safe via tRPC inference; the client never manually defines request/response types.

## Router Structure

```
appRouter
├── github
│   ├── getTeamPRs          # query — Fetch all open PRs for team members
│   ├── getPRsByUrls        # query — Fetch PR metadata for specific PR URLs (cascade)
│   └── getActivity         # query — Fetch GitHub activity events for timeline
├── jira
│   ├── getSprintIssues     # query — Fetch issues in current active sprint
│   ├── getEpicIssues       # query — Fetch issues for a specific epic
│   └── getActivity         # query — Fetch Jira activity events for timeline
└── config
    ├── get                 # query — Get current dashboard configuration
    └── update              # mutation — Update dashboard configuration
```

## Procedures

### github.getTeamPRs

Fetches all open PRs authored by or reviewing-requested for team members across configured GitHub organizations. Returns PRs with full review details, CI status, and labels.

**Input**:
```typescript
{
  // No input required — uses server-side config for team members and orgs
}
```

**Output**:
```typescript
{
  prs: PullRequest[]          // All open team PRs with reviews, checks, labels
  rateLimitRemaining: number  // GitHub API rate limit remaining
  rateLimitResetAt: string    // ISO 8601 timestamp of rate limit reset
  fetchedAt: string           // ISO 8601 timestamp of when data was fetched
}
```

**Errors**:
- `UNAUTHORIZED` — GitHub token is invalid or expired
- `FORBIDDEN` — GitHub rate limit exceeded (includes `rateLimitResetAt`)

---

### github.getPRsByUrls

Fetches GitHub PR metadata for a list of PR URLs. Used in the cascade phase after Jira reveals PRs not already fetched in `getTeamPRs`.

**Input**:
```typescript
{
  prUrls: string[]  // GitHub PR URLs to fetch (e.g. "https://github.com/org/repo/pull/123")
}
```

**Output**:
```typescript
{
  prs: PullRequest[]          // PR metadata for the requested URLs
  notFound: string[]          // URLs that could not be resolved (404, private, etc.)
  fetchedAt: string
}
```

**Errors**:
- `UNAUTHORIZED` — GitHub token invalid
- `FORBIDDEN` — Rate limit exceeded
- `BAD_REQUEST` — Invalid URL format in input

---

### github.getActivity

Fetches GitHub activity events (PR opens, merges, reviews, comments, pushes) for the specified user within a time window.

**Input**:
```typescript
{
  username: string   // GitHub username to fetch activity for
  days: number       // Number of days of history (default: 7, max: 30)
}
```

**Output**:
```typescript
{
  events: ActivityEvent[]  // Chronologically ordered GitHub events
  fetchedAt: string
}
```

---

### jira.getSprintIssues

Fetches all issues in the current active sprint for the configured project/component. Includes all fields needed for display and PR correlation.

**Input**:
```typescript
{
  // No input required — uses server-side config for project, component, sprint label
}
```

**Output**:
```typescript
{
  issues: JiraIssue[]         // All sprint issues with PR URLs parsed
  sprintName: string          // Active sprint name (for display in group headers)
  sprintId: number            // Active sprint ID
  fetchedAt: string
}
```

**Errors**:
- `UNAUTHORIZED` — Jira token is invalid or expired
- `FORBIDDEN` — Jira rate limit exceeded
- `NOT_FOUND` — No active sprint found (returns empty issues with warning)

---

### jira.getEpicIssues

Fetches all issues in a specific epic, including sub-tasks, across all sprints.

**Input**:
```typescript
{
  epicKey: string              // Jira epic key (e.g. "RHOAIENG-27992")
  includeClosedResolved: boolean  // Whether to include Closed/Resolved issues (default: true)
}
```

**Output**:
```typescript
{
  issues: JiraIssue[]         // All epic issues
  epicSummary: string         // Epic's summary/title
  fetchedAt: string
}
```

**Errors**:
- `UNAUTHORIZED` — Jira token invalid
- `NOT_FOUND` — Epic key does not exist

---

### jira.getActivity

Fetches Jira activity events (status transitions, comments, field changes) for the specified user within a time window.

**Input**:
```typescript
{
  username: string   // Jira username to fetch activity for
  days: number       // Number of days of history (default: 7, max: 30)
}
```

**Output**:
```typescript
{
  events: ActivityEvent[]  // Chronologically ordered Jira events
  fetchedAt: string
}
```

---

### config.get

Returns the current dashboard configuration.

**Input**:
```typescript
{
  // No input
}
```

**Output**:
```typescript
{
  config: DashboardConfig     // Full configuration object
  configFilePath: string      // Absolute path to config file (for user reference)
}
```

---

### config.update

Updates the dashboard configuration. Merges provided fields with existing config (partial update).

**Input**:
```typescript
{
  config: Partial<DashboardConfig>  // Fields to update
}
```

**Output**:
```typescript
{
  config: DashboardConfig     // Updated full configuration
}
```

**Errors**:
- `BAD_REQUEST` — Validation error (e.g. empty team member name, invalid org)

## Client Usage Patterns

### Progressive Loading (PR Reviews View)

All hooks below are tRPC typed wrappers around @tanstack/react-query. Options like `enabled` and `refetchInterval` are React Query options passed through tRPC's hooks.

```typescript
// Phase 1: GitHub data (immediate)
const teamPRs = trpc.github.getTeamPRs.useQuery();

// Phase 2: Jira data (after GitHub succeeds)
const sprintIssues = trpc.jira.getSprintIssues.useQuery(undefined, {
  enabled: teamPRs.isSuccess,
});

// Phase 3: Cascade GitHub data for Jira-discovered PRs
const cascadePRUrls = useMemo(() => {
  // Find PR URLs in Jira issues that aren't already in teamPRs
  // ...compute difference...
}, [teamPRs.data, sprintIssues.data]);

const cascadePRs = trpc.github.getPRsByUrls.useQuery(
  { prUrls: cascadePRUrls },
  { enabled: cascadePRUrls.length > 0 },
);
```

### Progressive Loading (Sprint Status View — Jira Primary)

```typescript
// Phase 1: Jira data (immediate)
const sprintIssues = trpc.jira.getSprintIssues.useQuery();

// Phase 2: GitHub data for linked PRs (after Jira succeeds)
const linkedPRUrls = useMemo(() => {
  // Extract all PR URLs from Jira issues' linkedPRUrls field
  // ...
}, [sprintIssues.data]);

const linkedPRs = trpc.github.getPRsByUrls.useQuery(
  { prUrls: linkedPRUrls },
  { enabled: linkedPRUrls.length > 0 },
);
```

### Auto-Refresh with Toggle

```typescript
const [autoRefresh, setAutoRefresh] = useState(true);
const config = trpc.config.get.useQuery();
const interval = config.data?.config.autoRefreshIntervalMs ?? 300_000;

const teamPRs = trpc.github.getTeamPRs.useQuery(undefined, {
  refetchInterval: autoRefresh ? interval : false,
});
```

## Error Handling Strategy

All procedures return structured tRPC errors using standard error codes:

| Code | When | Client Behavior |
|------|------|-----------------|
| `UNAUTHORIZED` | Token invalid/expired | Show auth error banner, continue showing cached data |
| `FORBIDDEN` | Rate limit exceeded | Show rate limit warning with reset time, continue showing cached data |
| `NOT_FOUND` | Resource not found | Show warning, skip resource |
| `BAD_REQUEST` | Invalid input | Show validation error |
| `INTERNAL_SERVER_ERROR` | Unexpected failure | Show generic error, continue showing cached data |

The client always continues displaying the last successfully fetched data when errors occur (per FR-023). Error banners appear above the table without replacing content.
