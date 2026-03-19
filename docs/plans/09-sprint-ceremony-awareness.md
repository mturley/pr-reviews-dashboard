# 09: Sprint Ceremony Awareness

**Status:** Planned (Phase 2)

## Overview

Detect sprint ceremonies (standup, retro, planning, refinement) from calendar events and show contextual information relevant to each ceremony type. When a ceremony is upcoming or in progress, the dashboard adapts to surface the most relevant data.

## User Stories

- As a developer approaching standup, I want to see a standup-ready summary automatically.
- As a scrum master before sprint planning, I want to see the backlog and capacity data.
- As a team member before retro, I want to see sprint metrics and highlights.

## Detection Strategy

Match calendar event titles against configurable patterns:
- **Standup:** `standup`, `daily scrum`, `daily sync`
- **Retro:** `retro`, `retrospective`
- **Planning:** `sprint planning`, `planning`
- **Refinement:** `refinement`, `grooming`, `backlog`

Patterns stored in config as `sprintCeremonyPatterns` with defaults.

## Contextual Views

### Before Standup (within 30 minutes)
- Show standup summary (same as Standup tab content)
- Highlight in navbar: "Standup in 15 min"

### Before Sprint Planning
- Show backlog items (ungroomed stories)
- Show team capacity (based on calendar — who's OOO this sprint?)
- Show velocity from previous sprints

### Before Retro
- Show sprint metrics: PRs merged, story points completed, review turnaround times
- Show highlights: biggest PRs, most-discussed items

### Before Refinement
- Show upcoming epic items without story points
- Show items flagged for discussion

## Dependencies

- Depends on: Google Calendar service (Step 4), Standup Summary
- Related to: Overview Tab (could show ceremony context there too)

## Open Questions

- How far in advance should ceremony awareness activate? 30 minutes? 1 hour?
- Should it change the default tab or just show a banner/notification?
- Should ceremony detection work without Google Calendar (using sprint schedule patterns)?
