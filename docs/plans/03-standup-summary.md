# 03: Standup Summary

**Status:** In Progress (Phase 1C)

## Overview

A dedicated `/standup` route that aggregates activity data, calendar events, and current work status into a daily standup summary with Yesterday/Today/Blockers sections. Includes a copy-to-clipboard feature for pasting into Slack standup threads.

## User Stories

- As a developer, I want to see a pre-built standup summary when I start my day so I don't have to manually reconstruct what I did yesterday.
- As a developer, I want to copy my standup summary and paste it into Slack with one click.
- As a developer, I want to see my blockers (stale PRs, blocked Jira issues, failing CI) highlighted separately.

## Data Sources

- **GitHub Activity** — `trpc.github.getActivity` (existing endpoint, shared query cache)
- **Jira Activity** — `trpc.jira.getActivity` (existing endpoint, shared query cache)
- **Google Calendar** — `trpc.google.getCalendarEvents` (new, optional)
- **PR Review Data** — `useProgressiveData` (existing hook, for recommended actions and CI status)
- **Sprint Data** — `trpc.jira.getSprintIssues` (existing endpoint, for in-progress items)

## Architecture

### Route

```
packages/client/src/
  routes/standup.tsx            — Main standup view component
  lib/standup-formatter.ts      — Plain text formatter for clipboard export
```

### Nav Position

5th tab, after "My Activity": PRs > Sprint > Epic > Activity > **Daily Standup**

## UI Description

### Yesterday Section

- **PRs reviewed** — List of PRs you reviewed, with repo and PR title
- **PRs merged** — List of PRs you merged
- **Jira issues updated** — Status changes, comments, field updates
- **Meetings attended** — Calendar events from yesterday (if Google enabled)

### Today Section

- **Calendar events** — Today's schedule (if Google enabled)
- **Recommended actions** — Top priority items from the existing recommended actions logic
- **Sprint items in progress** — Your Jira issues currently in progress

### Blockers Section

- **Stale PRs** — Open PRs older than `staleThresholdDays` (configurable)
- **Blocked Jira issues** — Issues with the blocked flag set, with reason
- **Failing CI** — Your PRs where checks are failing

### Copy to Clipboard

Button generates Slack-compatible markdown:
```
*Yesterday:*
- Reviewed PR #123 - Fix model registry pagination (odh-dashboard)
- Merged PR #120 - Add catalog view (odh-dashboard)
- RHOAIENG-4567: Moved to Code Review

*Today:*
- 10:00 Standup
- 14:00 Sprint Planning
- Top action: Re-review PR #125 (odh-dashboard)

*Blockers:*
- PR #119 has been open for 12 days with no review
- RHOAIENG-4570 is blocked: Waiting on API team
```

## Reused Code

- `trpc.github.getActivity` / `trpc.jira.getActivity` — same endpoints as Activity Timeline
- `deriveRecommendedActions()` from `packages/server/src/logic/recommended-actions.ts`
- `useProgressiveData` from `packages/client/src/hooks/useProgressiveData.ts`
- `useAutoRefreshContext` from `packages/client/src/hooks/useAutoRefreshContext.tsx`

## Dependencies

- Depends on: Foundation (Step 1)
- Enhanced by: Google Calendar (Step 4 — adds calendar sections)
- No hard dependency on Slack — works with just GitHub + Jira

## Open Questions

- Should the standup view auto-detect "yesterday" as the previous business day (skip weekends)?
- Should there be a date picker to view standup for a different day?
- Should the standup view show the full recommended actions panel or just the top N items?
