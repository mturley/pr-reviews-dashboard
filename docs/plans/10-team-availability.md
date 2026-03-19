# 10: Team Availability

**Status:** Planned (Phase 2)

## Overview

Show team members' availability based on their calendar data alongside their PRs and Jira issues. Helps prioritize review requests and understand response time expectations.

## User Stories

- As a reviewer, I want to know if a PR author is in meetings all day so I know they won't respond to feedback quickly.
- As a PR author, I want to see which reviewers are available so I can request reviews from people who can respond soon.
- As a team lead, I want to see who's OOO so I can reassign their review requests.

## Data Sources

- **Google Calendar** — Free/busy API for team members (requires calendar sharing)
- Alternatively: detect all-day events with OOO/PTO keywords

## UI Description

- Small availability indicator next to team member names in PR tables:
  - Green dot: available (no current meetings)
  - Yellow dot: in a meeting (but working today)
  - Gray dot: OOO/PTO (all-day event detected)
- Hover for details: current meeting name, next available time, timezone
- Optional: team availability summary widget on Overview tab

## Privacy Considerations

- Only show free/busy status, not meeting details, for other team members
- Respect calendar sharing settings — if a team member hasn't shared their calendar, show no indicator
- Make this feature opt-in per team member

## Dependencies

- Depends on: Google Calendar service, team member Google account linking
- Related to: Overview Tab, PR Reviews table

## Open Questions

- How to link team members to their Google accounts? Add `googleEmail` to `TeamMember` config?
- Should we use the Google Free/Busy API or parse calendar events directly?
- How to handle timezone differences in the team?
- Should availability affect PR priority sorting (e.g. deprioritize PRs from OOO authors)?
