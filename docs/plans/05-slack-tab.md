# 05: Slack Tab

**Status:** Planned (Phase 2)

## Overview

A dedicated `/slack` route showing recent Slack threads the user is involved with, plus threads from a configured set of watched channels. Each thread displays extracted links categorized by type (PR, Jira issue, Confluence doc, Miro board, etc.).

## User Stories

- As a developer, I want to see recent Slack threads I'm involved in alongside my PR and Jira workflow.
- As a developer, I want to quickly find links shared in team channels without scrolling through Slack history.
- As a team lead, I want to see which PRs and issues are being discussed in team channels.

## Data Sources

- **Slack Web API** — `conversations.history` for watched channels, `search.messages` for user's threads
- Requires additional scopes beyond `search:read`: `channels:history`, `channels:read`, `users:read`
- `slackWatchedChannels` config field lists channel IDs to monitor

## UI Description

- Two sections: "My Threads" (threads user participated in) and "Watched Channels" (recent threads from configured channels)
- Each thread shows: channel name, participants, latest message preview, timestamp
- Extracted links section per thread, categorized:
  - GitHub PRs (with state icon: open/merged/closed)
  - Jira issues (with status badge)
  - Confluence pages
  - Miro boards
  - Other URLs
- Click a link to open in the detail modal (for PRs/Jira) or external browser (for others)
- Filter by channel, date range, or link type

## Link Extraction

Parse message text for URLs matching known patterns:
- `github.com/{org}/{repo}/pull/{number}` -> PR link
- `{jiraHost}/browse/{KEY-123}` -> Jira link
- `*.atlassian.net/wiki/*` -> Confluence link
- `miro.com/app/board/*` -> Miro link
- Generic URL fallback for others

## Dependencies

- Depends on: Slack Thread Linking (Phase 1A — shares Slack service infrastructure)
- Requires additional Slack API scopes beyond Phase 1

## Open Questions

- How many threads to show per channel? Configurable limit?
- Should we support Slack DMs or only channels?
- Should extracted PR/Jira links be enriched with live status data from GitHub/Jira APIs?
- Rate limits for `conversations.history` — how to handle many watched channels?
