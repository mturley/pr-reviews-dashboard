# 02: Context Hub

**Status:** In Progress (Phase 1B)

## Overview

Add a "Context" tab to the detail modal for PRs and Jira issues that aggregates external references from Slack, Calendar, and Email. This gives a complete picture of all communication around a work item in one place.

## User Stories

- As a reviewer, I want to see all Slack threads, calendar meetings, and email threads about a PR in one place before starting my review.
- As a PR author, I want to quickly find where my PR has been discussed across different tools.
- As a team member looking at a Jira issue, I want to see all related communication without searching each tool separately.

## Data Sources

- **Slack** — Thread search via `search.messages` (reuses Slack Thread Linking infrastructure)
- **Google Calendar** — Event search by PR/issue reference in title or description (Phase 1: placeholder, wired in Step 4)
- **Gmail** — Email search for PR/issue URLs (future phase: placeholder)

## Architecture

### New Tab Type

Added to the detail modal's discriminated union:
```typescript
interface ContextTab {
  type: "context";
  label: string;
  targetUrls: string[];    // URLs to search across integrations
  targetType: "pr" | "jira";
}
```

### Component

```
packages/client/src/
  components/detail-modal/ContextHubContent.tsx
```

Renders independent sections per data source, each with its own loading state. Sections for unconfigured integrations are hidden entirely — the component adapts to show only what's available.

## UI Description

The "Context" tab appears after the existing tabs (PR Details, Files Changed, linked Jira issues) when at least one integration is enabled.

Content is organized as collapsible cards:

**Slack Threads** (when Slack enabled):
- List of threads with: channel name, author, date, snippet (150 chars), reply count
- Each thread links to its Slack permalink
- Count badge on section header

**Calendar Events** (when Google enabled, wired in Step 4):
- Events where the PR URL or Jira key appears in the title or description
- Shows: event title, date/time, calendar label (Work/Personal), attendees

**Emails** (future phase):
- Hidden until Gmail integration is implemented

## Dependencies

- Depends on: Slack Thread Linking (Step 2), Foundation (Step 1)
- Enhanced by: Google Calendar (Step 4), Email Tab (Phase 2)

## Open Questions

- Should the Context tab be the default active tab when opening a modal, or should it stay as the last tab?
- Should we cache context data per PR/issue in the modal provider's registry to avoid re-fetching when switching tabs?
