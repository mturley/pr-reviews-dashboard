# Feature Plans

Roadmap for extending the PR Reviews Dashboard with additional data source integrations and views.

## Phase 1: In Progress

| # | Feature | Description |
|---|---------|-------------|
| 01 | [Slack Thread Linking](01-slack-thread-linking.md) | Surface Slack threads mentioning PRs and Jira issues throughout the dashboard |
| 02 | [Context Hub](02-context-hub.md) | "Context" tab in detail modals aggregating Slack, Calendar, and Email references |
| 03 | [Standup Summary](03-standup-summary.md) | Daily standup view with Yesterday/Today/Blockers sections and clipboard export |

## Phase 2: Planned

| # | Feature | Description |
|---|---------|-------------|
| 04 | [Calendar Tab](04-calendar-tab.md) | Multi-account Google Calendar view with meeting context |
| 05 | [Slack Tab](05-slack-tab.md) | Recent Slack threads with extracted links to PRs, issues, docs, etc. |
| 06 | [Email Tab](06-email-tab.md) | Emails containing PR and Jira issue links |
| 07 | [Notification Center](07-notification-center.md) | Unified notifications from GitHub, Jira, Slack, and Email |
| 08 | [Overview Tab](08-overview-tab.md) | High-level summary dashboard (new default route) |
| 09 | [Sprint Ceremony Awareness](09-sprint-ceremony-awareness.md) | Calendar-aware sprint ceremony context |
| 10 | [Team Availability](10-team-availability.md) | Calendar-based team member availability overlay |

## Cross-Cutting Principles

- **All integrations are optional.** The app works fully with just GitHub + Jira tokens. When Slack or Google credentials are absent, related UI elements are hidden entirely.
- **Graceful degradation.** Each view adapts to show only the data sources that are configured.
- **No new databases.** All data comes from external APIs with in-memory TTL caching, matching the existing architecture.
