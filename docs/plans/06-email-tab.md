# 06: Email Tab

**Status:** Planned (Phase 2)

## Overview

A dedicated `/email` route showing emails that contain links to PRs and Jira issues. Surfaces GitHub notification emails, Jira notification emails, and any other emails referencing work items.

## User Stories

- As a developer, I want to see emails related to my PRs and Jira issues without checking my inbox separately.
- As a developer, I want to find the email thread where a PR review request was sent.
- As a developer, I want to see GitHub notification emails I haven't acted on yet.

## Data Sources

- **Gmail API** — `messages.list` with query filters, `messages.get` for details
- Requires Gmail API scope (`gmail.readonly`)
- Uses same Google OAuth credentials as Calendar

## UI Description

- List of emails containing PR or Jira URLs
- Each email shows: subject, sender, date, snippet, extracted links
- Filter by: source (GitHub notifications, Jira notifications, other), date range, read/unread
- Click an extracted PR/Jira link to open the detail modal
- "Open in Gmail" link for each email

## Search Strategy

- Search for emails from `notifications@github.com` (GitHub notifications)
- Search for emails from the Jira instance domain
- Search for emails containing known PR URLs or Jira issue keys
- Cache results with 5-minute TTL

## Dependencies

- Depends on: Google Calendar service (shares Google OAuth infrastructure)
- Related to: Context Hub (can populate email section), Notification Center

## Open Questions

- Should we support marking emails as read from the dashboard?
- Should we deduplicate with GitHub's native notification system?
- How to handle high email volume — pagination vs. time-based limits?
- Should we support multiple Gmail accounts (work + personal)?
