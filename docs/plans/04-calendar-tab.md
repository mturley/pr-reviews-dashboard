# 04: Calendar Tab

**Status:** Planned (Phase 2)

## Overview

A dedicated `/calendar` route showing a multi-account Google Calendar view. Supports combining work and personal calendars in a single view. Calendar events are enriched with PR/Jira context when event titles or descriptions reference work items.

## User Stories

- As a developer, I want to see my work and personal calendars in one place alongside my development workflow.
- As a developer, I want to see which meetings are related to PRs or Jira issues I'm working on.
- As a team lead, I want to see my meeting load for the day and how it relates to sprint work.

## Data Sources

- **Google Calendar API** — Events list endpoint, supports multiple accounts
- Multi-account support via `googleAccounts[]` config array
- Each account can filter to specific calendar IDs

## Auth

CLI setup script (`pnpm setup:google --label "Work"`):
1. Opens browser for OAuth consent
2. Captures auth code, exchanges for refresh token
3. Writes to `config.local.json` under `googleAccounts[]`
4. Can be run multiple times for multiple accounts

## UI Description

- Day/week toggle view
- Events color-coded by calendar account label (Work vs Personal)
- Events containing PR URLs or Jira keys show inline badges linking to those items
- Click an event to see full details, attendees, meeting link
- "Open in Google Calendar" link for each event

## Dependencies

- Depends on: Google Calendar service (Step 4 of Phase 1)
- Related to: Standup Summary (shares calendar data), Sprint Ceremony Awareness

## Open Questions

- Should the calendar show team members' availability if they share their calendars?
- Should we support calendar event creation (e.g. "schedule review time for this PR")?
- Week view vs day view — which is the default?
