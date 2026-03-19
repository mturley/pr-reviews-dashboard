# 08: Overview Tab

**Status:** Planned (Phase 2)

## Overview

A new default route (`/`) showing a high-level summary dashboard with cards/widgets pulling key information from all other tabs. Designed to be the first thing you see when opening the app — a quick "state of the world" before diving into any specific view.

## User Stories

- As a developer, I want to see the most important information at a glance when I open the dashboard.
- As a developer, I want quick access to my top-priority actions without navigating to the PR Reviews tab.
- As a team lead, I want a summary of team activity and sprint health in one view.

## UI Description

### Proposed Widget Layout

**Row 1: Immediate Actions**
- **Top 3 Recommended Actions** — Pulled from existing recommended actions logic. Each shows action type, PR title, and linked Jira issue.
- **Unread Notifications Count** — Badge linking to notification center (when implemented).

**Row 2: Today's Context**
- **Today's Calendar** — Compact event list for the day (when Google enabled). Highlights upcoming meetings.
- **Active Slack Threads** — Recent threads mentioning your PRs/issues (when Slack enabled).

**Row 3: Sprint Health**
- **Sprint Progress** — Story points completed vs total, burndown indicator.
- **My In-Progress Items** — Jira issues assigned to you currently in progress, with linked PR status.
- **Stale Items** — PRs or issues that need attention (old PRs, blocked issues).

**Row 4: Quick Links**
- Links to each tab with summary counts (e.g. "12 open PRs", "3 items need review", "5 calendar events today").

### Responsive Design

Widgets reflow based on viewport width. On narrow screens, stack vertically. On wide screens, use a 2-3 column grid.

## Route Change

When this tab is implemented:
- Overview becomes `/` (the new default)
- PR Reviews moves to `/prs`
- All other routes unchanged

## Dependencies

- Depends on: All Phase 1 features (for data), ideally all Phase 2 features for full widget coverage
- Can be implemented incrementally — start with GitHub+Jira widgets, add Calendar/Slack/Email widgets as those integrations ship

## Open Questions

- Should widgets be configurable (drag to reorder, hide/show)?
- Should the overview auto-refresh more aggressively than other views?
- Should it replace the PR Reviews tab as the default, or be opt-in?
- How to handle the overview when no optional integrations are configured (just GitHub+Jira)?
