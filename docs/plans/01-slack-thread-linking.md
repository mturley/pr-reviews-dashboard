# 01: Slack Thread Linking

**Status:** In Progress (Phase 1A)

## Overview

Search Slack for messages containing PR URLs and Jira issue URLs, then surface those threads throughout the dashboard as small indicators on PR table rows, Jira issue rows, and in detail modals.

## User Stories

- As a reviewer, I want to see if a PR has been discussed in Slack so I can read the context before reviewing.
- As a PR author, I want to find the Slack thread where my PR was discussed so I can follow up.
- As a team lead, I want to see which PRs have Slack discussion happening outside of GitHub so nothing falls through the cracks.

## Data Source

**Slack Web API** — `search.messages` endpoint.

- Requires a **user token** (`xoxp-...`) with `search:read` scope
- Searches for exact URL matches in message text
- Returns channel name, message permalink, snippet, author, reply count
- Rate limit: Tier 2 (~20 requests/minute)

### Auth Setup

1. Create a Slack app at api.slack.com/apps
2. Add `search:read` user token scope under OAuth & Permissions
3. Install the app to the workspace
4. Copy the User OAuth Token (`xoxp-...`) to `.env` as `SLACK_USER_TOKEN`

## Architecture

### Server

```
packages/server/src/
  services/slack/
    client.ts       — HTTP client with throttle (1 req/3s)
    transforms.ts   — Response -> SlackThread[] transform
  types/slack.ts    — SlackThread type definition
  routers/slack.ts  — tRPC router with searchByUrls procedure
```

### Client

```
packages/client/src/
  hooks/useSlackThreads.ts                    — Hook calling trpc.slack.searchByUrls
  components/shared/SlackThreadIndicator.tsx   — Icon + count badge + tooltip
```

## UI Description

- **PR table:** Optional "Slack" column showing a small Slack icon with thread count. Tooltip lists channel names and message snippets. Clicking opens the thread permalink.
- **Detail modal (PR and Jira):** "Slack Threads" section listing each thread with channel, author, date, snippet, and reply count. Each links to the Slack permalink.

## Rate Limit Strategy

- Batch URLs using Slack search OR syntax: `"url1" OR "url2"` (up to ~5 per query)
- 5-minute TTL cache (threads are stable, rate limits are tight)
- Slack data loads asynchronously — never blocks dashboard rendering
- If rate limited, indicators silently don't appear

## Dependencies

- Depends on: Foundation (Step 1 — config types, integration status)
- Depended on by: Context Hub (Step 3), Slack Tab (Phase 2)

## Open Questions

- Should we also search for Jira issue keys (e.g. `RHOAIENG-12345`) in addition to full URLs? This would catch more mentions but increase search volume.
- Should thread indicators show in the recommended actions panel alongside PR actions?
