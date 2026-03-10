# Feature Specification: PR Reviews Dashboard MVP

**Feature Branch**: `001-dashboard-mvp`
**Created**: 2026-03-09
**Status**: Draft
**Input**: User description: "Personalized PR reviews dashboard with GitHub and Jira integration, progressive loading, team views, activity timeline"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View My PR Review Status at a Glance (Priority: P1)

As a developer, I open the dashboard in my browser and immediately
see a grouped table of pull requests relevant to me. The default
view shows four sections: "My PRs" (PRs I authored), "PRs I'm
Reviewing" (PRs where I am a reviewer), "Other PRs for [current
sprint] issues in Review state" (team PRs linked to Jira issues
currently in review), and "Other [team] PRs with No Jira" (team
member PRs that have no associated Jira issue). Each row shows the
PR title, repository, author, age, review status with visual
indicators, CI status, and draft/mergeable state. The review status
column uses color-coded indicators to distinguish states like
"Approved", "Waiting for review", "Has new comments", and "Needs
re-review" so I can instantly see what needs my attention.

**Why this priority**: This is the core value proposition — replacing
the slow, token-expensive Claude Code skill with an always-available
dashboard that shows me what to work on right now.

**Independent Test**: Can be fully tested by loading the dashboard
with valid GitHub credentials and verifying that PRs appear in the
correct groups with accurate review status indicators.

**Acceptance Scenarios**:

1. **Given** the dashboard is loaded and GitHub data has been
   fetched, **When** I view the default grouped table, **Then** I
   see my authored PRs in the "My PRs" section with review status,
   CI status, and age for each.
2. **Given** a PR I'm reviewing has new comments since my last
   review, **When** I view the "PRs I'm Reviewing" section,
   **Then** that PR shows a visual indicator (e.g. red dot) for
   "Has new comments".
3. **Given** a team member has an open PR with no linked Jira issue,
   **When** I view the "Other [team] PRs with No Jira" section,
   **Then** that PR appears in this group.

---

### User Story 2 - Progressive Loading with GitHub First (Priority: P1)

As a developer, each view loads its primary data source first and
cascades to the secondary source afterward. In the default PR
Reviews view, GitHub data (my PRs, PRs I'm reviewing) appears
within seconds. Jira-linked data loads afterward — columns like
Jira issue key, type, priority, assignee, and state progressively
appear as Jira data arrives. Some table rows (e.g. "Other PRs for
sprint issues in Review state") only appear after Jira data is
loaded, since they require sprint information. After Jira data loads
and reveals additional PRs (e.g. PRs linked to sprint issues),
those PRs' GitHub metadata is fetched in a second cascade.

In Jira-primary views (Sprint Status, Epic Status), Jira data loads
first and the table populates with issue details. GitHub PR metadata
(review status, CI status) then cascades in as linked PRs are
discovered from each issue's "Git Pull Request" field.

Loading indicators clearly show which data is still being fetched
in all views.

**Why this priority**: The Jira API is slow and the user specifically
wants to see useful data while waiting. This progressive loading
pattern is essential to the dashboard feeling fast, regardless of
which data source is primary for a given view.

**Independent Test**: Can be tested by loading the dashboard and
observing that GitHub data appears first, followed by Jira columns
populating, followed by any additional GitHub data for newly
discovered PRs.

**Acceptance Scenarios**:

1. **Given** the default PR Reviews view is loading, **When**
   GitHub data arrives but Jira data has not, **Then** the "My PRs"
   and "PRs I'm Reviewing" sections display with GitHub-only columns
   and loading indicators where Jira columns will appear.
2. **Given** any view is loading its secondary data source, **When**
   specific columns or rows are not yet available, **Then** a
   loading indicator is shown rather than empty cells.
3. **Given** Jira data has loaded and revealed additional PRs linked
   to sprint issues, **When** those PRs' GitHub metadata is being
   fetched, **Then** the new rows appear with loading indicators
   for GitHub-specific columns.
4. **Given** the Sprint Status view is loading, **When** Jira data
   arrives but GitHub PR metadata has not, **Then** issues display
   with Jira-only columns and loading indicators where PR review
   status and CI status will appear.

---

### User Story 3 - Jira Issue Correlation (Priority: P1)

As a developer, for each PR that is associated with a Jira issue,
I see a clickable link to the Jira ticket along with its issue type
icon, assignee, current state, and priority. The association is
discovered from Jira's side: each Jira issue has a "Git Pull
Request" field containing PR URLs. PRs themselves do not link back
to Jira, since the team works in upstream communities that do not
use their Jira. This lets me understand the full context of a PR
without leaving the dashboard.

**Why this priority**: Jira correlation is a core differentiator from
plain GitHub dashboards and is needed to populate the sprint-based
table groups.

**Independent Test**: Can be tested by verifying that PRs with known
Jira links display the correct issue metadata, and PRs without Jira
links show no Jira columns or show them as empty.

**Acceptance Scenarios**:

1. **Given** a PR is linked to Jira issue RHOAIENG-12345, **When**
   Jira data has loaded, **Then** the row shows a clickable link to
   the issue with its type, priority, state, and assignee.
2. **Given** a PR has no linked Jira issue, **When** the table is
   fully loaded, **Then** the Jira columns for that row are empty
   or show a "No Jira" indicator.

---

### User Story 4 - Recommended Actions (Priority: P1)

As a developer, the dashboard shows a prioritized list of
recommended actions based on rule-based analysis of PR and review
state. The rules differ based on my relationship to each PR:

- **For my PRs**: Action needed when there are new reviews or
  comments since my last push. The action is to address feedback.
- **For PRs I'm reviewing**: Action needed when there are new
  commits since my last review. The action is to re-review.
- **For other team PRs**: Action needed when a PR has no reviews
  at all and is awaiting first review.

The review status column MUST visually distinguish between a PR
that has never been reviewed and one that has reviews but none from
me specifically. Actions are sorted by Jira priority (when
available), then by PR age.

**Why this priority**: This transforms the dashboard from a data
display into an actionable tool. Knowing what to do next is the
primary reason to check the dashboard.

**Independent Test**: Can be tested by creating PRs in known review
states and verifying the correct actions appear in priority order.

**Acceptance Scenarios**:

1. **Given** a PR I authored has a new review since my last push,
   **When** I view the Recommended Actions, **Then** an action
   appears telling me to address feedback on that PR.
2. **Given** a PR I'm reviewing has new commits since my last
   review, **When** I view the Recommended Actions, **Then** an
   action appears telling me to re-review that PR.
3. **Given** a team PR has no reviews at all, **When** I view the
   Recommended Actions, **Then** an action appears suggesting I
   review it.
4. **Given** multiple actions exist, **When** I view the list,
   **Then** actions are sorted by Jira priority (if available) then
   by PR age (oldest first).
5. **Given** a PR I'm reviewing has reviews from others but not
   from me, **When** I view its review status, **Then** I can
   distinguish it from a PR with no reviews at all.

---

### User Story 5 - Auto-Refresh with Toggle and Manual Refresh (Priority: P2)

As a developer, the dashboard automatically polls GitHub and Jira
for updated data on a regular interval so I always see current
information. I can toggle auto-refresh off if I want to stop polling
(e.g. to avoid Jira rate limits or to freeze the view while I work
through items). A manual refresh button is always available to
trigger an immediate data fetch regardless of auto-refresh state.
The last-refreshed timestamp is always visible.

**Why this priority**: Auto-refresh keeps the dashboard useful
throughout the day, but the toggle and manual refresh are critical
for avoiding Jira rate limiting.

**Independent Test**: Can be tested by enabling auto-refresh,
verifying data updates on schedule, toggling it off, verifying
polling stops, and using the manual refresh button.

**Acceptance Scenarios**:

1. **Given** auto-refresh is enabled, **When** the polling interval
   elapses, **Then** the dashboard fetches fresh data and updates
   the display.
2. **Given** auto-refresh is enabled, **When** I toggle it off,
   **Then** polling stops and no further automatic requests are
   made.
3. **Given** auto-refresh is off, **When** I click the manual
   refresh button, **Then** the dashboard fetches fresh data
   immediately.
4. **Given** any refresh state, **When** I view the dashboard,
   **Then** a last-refreshed timestamp is visible.

---

### User Story 6 - Grouping, Sorting, and Filtering Options (Priority: P2)

As a developer, I can change how the PR table is grouped, sorted,
and filtered. The default grouping is the four-section view described
in Story 1, but I can also group by repository, by Jira epic, by
Jira priority, or show a flat ungrouped list. I can sort by age,
priority, review status, or CI status. I can filter to show only
specific repositories, only PRs needing my action, only draft PRs,
etc.

**Why this priority**: The default view covers the most common use
case, but flexibility in grouping and filtering makes the dashboard
useful for different workflows and contexts.

**Independent Test**: Can be tested by changing grouping, sorting,
and filter options and verifying the table reorganizes correctly.

**Acceptance Scenarios**:

1. **Given** the default grouped view is displayed, **When** I
   select "Group by Repository", **Then** PRs are reorganized into
   sections by repository name.
2. **Given** a flat list view, **When** I sort by "Age (oldest
   first)", **Then** PRs are ordered by how long they have been
   open.
3. **Given** all PRs are displayed, **When** I filter to "Needs my
   action", **Then** only PRs where I have a pending review request
   or new comments are shown.

---

### User Story 7 - View as Another Team Member or Whole Team (Priority: P2)

As a developer, I can switch the dashboard perspective to view it
as if I were another team member — seeing their authored PRs, their
review assignments, etc. I can also switch to a "whole team" view
that shows all team PRs without breaking out "My PRs" vs "PRs I'm
Reviewing" (since there is no single "me" in team view). The
perspective selector shows all configured team members.

**Why this priority**: Viewing as another team member or the whole
team helps with standup preparation, sprint reviews, and mentoring.

**Independent Test**: Can be tested by selecting a different team
member and verifying that the table reflects their PR activity.

**Acceptance Scenarios**:

1. **Given** the dashboard shows my perspective, **When** I select
   a teammate from the perspective selector, **Then** the table
   updates to show their authored PRs, their review assignments,
   etc.
2. **Given** I select "Whole Team" view, **When** the table loads,
   **Then** all team PRs are shown in a flat or repository-grouped
   layout without "My PRs" / "PRs I'm Reviewing" separation.

---

### User Story 8 - Activity Timeline View (Priority: P3)

As a developer, I can switch to a chronological timeline view that
shows my recent activity across both GitHub and Jira. The timeline
groups events by day and shows Jira actions (status transitions,
comments, field changes) and GitHub actions (commits, PR
opens/reviews/merges) in chronological order with source indicators.
I can adjust the time window (default: 7 days).

**Why this priority**: The activity timeline is a secondary view
that complements the PR dashboard. It replaces the `/activity` skill
and is useful for standups and weekly summaries, but is not the
primary use case.

**Independent Test**: Can be tested by switching to the timeline
view and verifying that events from both GitHub and Jira appear in
correct chronological order grouped by day.

**Acceptance Scenarios**:

1. **Given** I navigate to the Activity Timeline view, **When** data
   has loaded, **Then** I see events grouped by day in reverse
   chronological order with source indicators.
2. **Given** the timeline is showing 7 days of activity, **When** I
   change the window to 14 days, **Then** additional older events
   appear.
3. **Given** I made a Jira status transition and a GitHub PR review
   on the same day, **When** I view that day's events, **Then** both
   appear in correct chronological order with their respective
   source indicators.

---

### User Story 9 - Sprint Status View (Priority: P3)

As a developer, I can switch to a sprint-focused view that shows all
issues in the current active sprint grouped by Jira status (Review,
Testing, In Progress, Backlog, Closed/Resolved). Each row shows the
Jira issue details (including story points and original story points)
alongside any linked PR metadata. This replaces the `/sprint-status`
skill.

**Why this priority**: The sprint view is a secondary perspective
useful for sprint ceremonies but is not the primary daily-use view.

**Independent Test**: Can be tested by switching to the Sprint Status
view and verifying issues appear grouped by Jira status with correct
PR linkage.

**Acceptance Scenarios**:

1. **Given** I navigate to the Sprint Status view, **When** sprint
   data has loaded, **Then** I see all sprint issues grouped by
   status with linked PR metadata.
2. **Given** a sprint issue has a linked PR, **When** I view its
   row, **Then** I see the PR's review status, CI status, and a
   link to the PR.

---

### User Story 10 - Epic Status View (Priority: P3)

As a developer, I can select a Jira epic (discovered from the
current sprint's issues) and see all issues in that epic across all
sprints, including sub-tasks. I can toggle visibility of
Closed/Resolved issues. This replaces the `/epic-status` skill.

**Why this priority**: Epic view is a tertiary perspective for
tracking longer-term work. It depends on the sprint view
infrastructure.

**Independent Test**: Can be tested by selecting an epic and
verifying all its issues appear with sprint and PR metadata.

**Acceptance Scenarios**:

1. **Given** I select an epic from the list, **When** epic data has
   loaded, **Then** I see all issues in that epic with their sprint
   assignments and PR linkage.
2. **Given** the epic view shows Closed issues, **When** I toggle
   "Hide Closed", **Then** Closed/Resolved issues are hidden.

---

### Edge Cases

- What happens when GitHub API rate limiting is hit? The dashboard
  MUST display a clear rate limit warning with the reset time and
  continue showing the last successfully fetched data.
- What happens when the Jira personal access token is expired or
  invalid? The dashboard MUST show an authentication error for Jira
  sections while continuing to display GitHub-only data.
- What happens when a team member's GitHub username cannot be found?
  The dashboard MUST skip that member's data and show a warning
  rather than failing entirely.
- What happens when the current sprint cannot be determined? The
  dashboard MUST show the GitHub-only sections and display a warning
  that sprint-based groups are unavailable.
- What happens when a PR is linked to a Jira issue that the user
  does not have permission to view? The dashboard MUST show the PR
  row with a "restricted" indicator in the Jira columns.
- What happens when no PRs match the current filters? The dashboard
  MUST show an empty state message rather than a blank table.

## Requirements *(mandatory)*

### Functional Requirements

**Configuration & Authentication**

- **FR-001**: System MUST allow the user to configure their GitHub
  identity, Jira identity, team name, a list of GitHub organizations
  to search for PRs, Jira project key, Jira component name, sprint
  discovery label, and team member roster (GitHub and Jira usernames
  for each member). All configuration MUST be persisted locally.
- **FR-002**: System MUST accept a Jira personal access token and
  a GitHub personal access token via environment variables, never
  stored in source control.
- **FR-003**: System MUST use the GitHub API directly for all
  GitHub data access. The system MUST NOT depend on the `gh` CLI.
- **FR-004**: All sensitive configuration (tokens, personal data,
  team roster) MUST be excluded from version control via
  `.gitignore` or equivalent.

**Data Fetching & Display**

- **FR-005**: In GitHub-primary views (PR Reviews), system MUST
  fetch and display GitHub PR data (authored, reviewing, team member
  PRs) first. Jira data MUST load progressively afterward, using
  each issue's "Git Pull Request" field as the sole source of truth
  for Jira-to-PR correlation.
- **FR-006**: In Jira-primary views (Sprint Status, Epic Status),
  system MUST fetch and display Jira issue data first. GitHub PR
  metadata (review status, CI status) MUST cascade in afterward as
  linked PRs are discovered from each issue's "Git Pull Request"
  field.
- **FR-007**: System MUST perform cascading fetches when one data
  source reveals entities that need metadata from the other source
  (e.g. Jira reveals new PRs needing GitHub metadata, or GitHub PRs
  are matched to Jira issues needing issue details).
- **FR-008**: System MUST display loading indicators for data that
  is still being fetched, distinguishing between "loading" and
  "no data".
- **FR-009**: System MUST display a last-refreshed timestamp for
  each data source (GitHub, Jira).
- **FR-010**: System MUST support automatic polling with a
  configurable interval, defaulting to on.
- **FR-011**: System MUST provide a toggle to disable/enable
  automatic polling.
- **FR-012**: System MUST provide a manual refresh button that
  triggers an immediate full data fetch.

**PR Table & Views**

- **FR-013**: System MUST display PRs in a table with columns for:
  PR title (linked), repository, author, age, review status
  indicators, CI status, draft state, and (when Jira data is
  available) Jira issue key (linked), issue type, priority, state,
  and assignee.
- **FR-014**: System MUST support the default four-group view:
  "My PRs", "PRs I'm Reviewing", "Other PRs for [sprint] issues
  in Review state", "Other [team] PRs with No Jira". When a PR
  qualifies for multiple groups, it MUST appear only in the
  highest-priority group. Priority order: "My PRs" > "PRs I'm
  Reviewing" > "Sprint Review" > "No Jira".
- **FR-015**: System MUST support alternative grouping options
  (by repository, by Jira epic, by priority, flat list).
- **FR-016**: System MUST support sorting by age, priority, review
  status, and CI status.
- **FR-017**: System MUST support filtering by repository, action
  needed, draft status, and review state. The "action needed" filter
  MUST use the same rules as Recommended Actions (FR-029) to ensure
  consistency between the actions panel and the filtered table view.
- **FR-018**: System MUST support switching perspective to view as
  another team member or as the whole team.
- **FR-019**: System MUST use color-coded visual indicators for
  review status states (e.g. red for "action needed", blue for
  "needs re-review", yellow for "needs review", green for
  "approved").
- **FR-028**: Every view that displays a PR MUST show its review
  status with visual indicators. Review status is the core
  action-signaling mechanism of the dashboard and MUST NOT be
  omitted from any PR display regardless of view or grouping.

**Recommended Actions**

- **FR-029**: System MUST display a prioritized Recommended Actions
  list in a collapsible panel above the PR table, expanded by
  default. The panel is derived from rule-based analysis of PR and
  review state.
  Rules differ by relationship to the PR:
  - For user's own PRs: action needed when new reviews/comments
    exist since user's last push.
  - For PRs user is reviewing: action needed when new commits exist
    since user's last review, OR when user is a requested reviewer
    who has not yet reviewed.
  - For other team PRs: action needed when PR has no reviews at all.
- **FR-030**: Actions MUST be sorted by Jira priority (when
  available), then by PR age (oldest first).
- **FR-031**: Review status indicators MUST visually distinguish
  between "no reviews at all" and "has reviews but none from me".
  These are different action signals: the first means the PR needs
  a first reviewer, the second means it may need my review
  specifically.
- **FR-032**: Recommended Actions MUST be rule-based for the MVP.
  LLM-powered action synthesis is a future enhancement and MUST NOT
  be a dependency for initial delivery.
- **FR-039**: The review status column MUST clearly communicate WHY
  action is needed, using a parenthetical label or tooltip to
  distinguish between action reasons (e.g. "Needs review (requested
  reviewer)", "Needs re-review (new commits)", "Has new feedback
  (2 new reviews)").

**Blocked & Stale Indicators**

- **FR-033**: When a Jira issue is marked as blocked, the dashboard
  MUST show a blocked indicator on the corresponding PR row. A
  tooltip or popover MUST display the "Blocked Reason" field
  content.
- **FR-034**: System MUST support toggleable stale PR highlighting
  with a user-selectable age cutoff. PRs older than the cutoff
  MUST be visually distinguished (e.g. color gradient or badge).
  The stale highlighting MUST be independently toggleable on/off.

**Column Customization**

- **FR-035**: System MUST provide a column customization modal that
  allows the user to select which columns are visible and reorder
  them. Column preferences MUST be persisted locally.
- **FR-036**: Columns MUST be categorized as default-on or
  default-off (optional). Column visibility is independent of data
  loading state — a column can be visible (enabled) while its data
  is still loading. Default-on columns include: PR title,
  repository, author, age, review status, CI status, Jira issue
  key, issue type, priority, state, and assignee. Default-off
  optional columns include: draft state, mergeable state, labels,
  blocked status, blocked reason, stale indicator, story points,
  original story points, and any additional metadata columns.
- **FR-037**: All Jira columns (both default-on and default-off)
  MUST be present in the column customization modal regardless of
  whether Jira data has loaded. When Jira data has not yet loaded,
  enabled Jira columns MUST show loading indicators in their cells
  rather than being hidden.

**View State Persistence**

- **FR-038**: All view state (grouping, sorting, filtering,
  perspective, column selection, stale highlighting toggle and
  cutoff) MUST be encoded in the URL query string so that views
  can be bookmarked and shared.

**Alternate Views**

- **FR-020**: System MUST provide an Activity Timeline view showing
  chronological GitHub and Jira events grouped by day with source
  indicators and an adjustable time window (default: 7 days).
- **FR-021**: System MUST provide a Sprint Status view showing
  current sprint issues grouped by Jira status with linked PR
  metadata, story points, and original story points.
- **FR-022**: System MUST provide an Epic Status view showing all
  issues in a selected epic (including sub-tasks) across sprints,
  with a toggle to show/hide Closed/Resolved issues.

**Jira Platform Portability**

- **FR-026**: System MUST isolate all Jira-specific data access
  behind a consistent boundary so that switching from Jira
  Datacenter to Jira Cloud requires changes only to the Jira access
  layer, not to the rest of the application.
- **FR-027**: System MUST NOT depend on Jira Datacenter-specific
  behaviors (custom field ID formats, API URL patterns, sprint
  object shapes) outside of the Jira access layer.

**Resilience**

- **FR-023**: System MUST continue to function and display available
  data when one data source (GitHub or Jira) is unavailable or
  rate-limited.
- **FR-024**: System MUST display clear error messages with context
  (e.g. rate limit reset time) when a data source fails.

**Deployment**

- **FR-025**: System MUST run as a local-only web application on
  localhost, with no external hosting or multi-user authentication
  required.

### Key Entities

- **Pull Request**: A GitHub PR with metadata including title, repo,
  author, state, draft status, mergeable state, review status (per
  reviewer), CI status, age, labels, and linked Jira issue (if any).
- **Jira Issue**: A Jira ticket with key, type, summary, priority,
  state, assignee, sprint, epic, linked PR URLs, blocked status,
  blocked reason, story points, and original story points.
- **Team Member**: A person with a display name, GitHub username,
  Jira username, and email.
- **Sprint**: A Jira sprint with a name, ID, state (active/closed),
  and associated issues.
- **Epic**: A Jira epic with a key, summary, and child issues across
  sprints.
- **Activity Event**: A timestamped action from either GitHub or
  Jira, with source indicator, actor, action type, and target
  entity.

## Clarifications

### Session 2026-03-09

- Q: When a PR qualifies for multiple default groups, which group should it appear in? → A: Priority-based deduplication. Each PR appears in highest-priority group only: "My PRs" > "PRs I'm Reviewing" > "Sprint Review" > "No Jira".
- Q: How does the system know which GitHub repositories to search? → A: A configured and persisted list of GitHub organizations. Only PRs in repos belonging to those orgs are searched.
- Q: How are Jira queries scoped? → A: Jira project key, component name, and sprint discovery label are all user-configurable (not hardcoded). Supports reuse if team structure changes and aligns with Jira platform portability (FR-026/027).

### Session 2026-03-10

- Q: Should Jira columns be default-on or default-off? → A: Column visibility (enabled/disabled) is orthogonal to data loading state. Core Jira columns (key, type, priority, state, assignee) are default-on. They show loading indicators while Jira data is fetching, not hidden. Supplementary Jira columns (story points, blocked) are default-off.
- Q: Where do Recommended Actions appear in the UI? → A: Collapsible panel above the PR table, expanded by default.
- Q: Should "Needs my action" filter use the same rules as Recommended Actions? → A: Yes, broader rules for both. Includes requested-reviewer-who-hasn't-reviewed in addition to new-commits-since-last-review. Review status column must clearly show WHY action is needed via parenthetical or tooltip.

## Assumptions

- The user has a GitHub personal access token with read access to
  the relevant repositories.
- The user has a valid Jira personal access token with read access to
  their project.
- Both tokens are provided via environment variables, following a
  consistent credential pattern across data sources.
- The team roster (people data) is configured once and updated
  manually; the app does not need to auto-discover team members.
- The Jira project key, component name, and sprint discovery label
  are user-configurable. Default values match the current team setup
  (project: RHOAIENG, component: AI Core Dashboard, sprint label:
  dashboard-green-scrum).
- Jira-to-PR linking is done via Jira's "Git Pull Request" custom
  field, which contains a comma-separated list of GitHub PR URLs.
  This is the sole source of truth for correlating Jira issues and
  PRs — PRs do not link back to Jira, because the team works in
  upstream communities that do not use their Jira instance.
- The initial deployment targets Jira Datacenter. A migration to
  Jira Cloud is anticipated; the Jira access layer MUST be designed
  so that this migration does not require changes outside of that
  layer.
- The dashboard is single-user (localhost only) so there is no need
  for user authentication, sessions, or multi-tenancy.
- Auto-refresh polling interval defaults to a value that avoids
  Jira rate limiting (e.g. 5 minutes minimum).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: User can see their PR review status within 5 seconds
  of opening the dashboard (GitHub data only, before Jira loads).
- **SC-002**: Full dashboard with Jira data loads within 30 seconds
  of page open, with progressive updates visible during loading.
- **SC-003**: User can determine which PRs need their immediate
  action within 10 seconds of viewing the loaded dashboard.
- **SC-004**: Switching between team member perspectives updates the
  view within 5 seconds (using cached data when available).
- **SC-005**: The dashboard replaces the need to run `/reviews-status`,
  `/sprint-status`, `/epic-status`, and `/activity` skills,
  eliminating AI token consumption for these reports.
- **SC-006**: Auto-refresh operates without triggering Jira rate
  limiting during a full workday of use.
- **SC-007**: All four default table groups populate correctly,
  matching the data that the existing `/reviews-status` skill
  produces.
