# 07: Notification Center

**Status:** Planned (Phase 2)

## Overview

A unified notification feed aggregating unread/unacted notifications from GitHub, Jira, Slack, and Email into a single deduplicated stream. Replaces the need to check multiple tools for new activity.

## User Stories

- As a developer, I want one place to see all new notifications across my tools.
- As a developer, I want notifications deduplicated — if a PR review request came via GitHub email, Slack message, and Jira comment, I want to see it once.
- As a developer, I want to mark items as "seen" in the dashboard and have that persist.

## Data Sources

- **GitHub** — Notification emails (via Gmail) or GitHub Notifications API
- **Jira** — Issue update notifications (via Jira activity or email)
- **Slack** — Mentions and DMs in watched channels
- **Email** — Gmail unread messages matching work item patterns

## Deduplication Strategy

Notifications are grouped by **work item** (PR or Jira issue). Multiple notifications about the same PR from different sources are merged into a single entry showing all source indicators (GitHub icon, Slack icon, email icon).

## UI Description

- Notification bell icon in navbar with unread count badge
- Dropdown or panel showing recent notifications, newest first
- Each notification shows: work item (PR or Jira issue), action summary, source icons, timestamp
- Click to open detail modal for the work item
- "Mark all as read" and per-item dismiss
- Notification state persisted to localStorage (or config file)

## Dependencies

- Depends on: Slack Tab (Slack API scopes), Email Tab (Gmail API), all Phase 1 features
- This is a capstone feature that ties together all data sources

## Open Questions

- Should notification state sync across browser tabs/windows?
- Should we support push notifications via Service Worker (PWA)?
- How far back should we look for notifications? Last 24h? Since last visit?
- Should mark-as-read propagate back to source tools (mark email as read, etc.)?
