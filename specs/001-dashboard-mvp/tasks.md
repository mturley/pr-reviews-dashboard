# Tasks: PR Reviews Dashboard MVP

**Input**: Design documents from `/specs/001-dashboard-mvp/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/trpc-router.md, quickstart.md

**Tests**: Not explicitly requested in the spec. Test tasks are omitted. Constitution V (Test at Boundaries) will be addressed in the Polish phase.

**Organization**: Tasks are grouped by user story. US2 (Progressive Loading) is ordered after US3 (Jira Correlation) because progressive loading is the integration layer between GitHub and Jira data sources.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

This project uses pnpm workspaces with two packages:
- **Server**: `packages/server/src/`
- **Client**: `packages/client/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the pnpm workspace monorepo with both packages, tooling, and config

- [x] T001 Create root package.json with pnpm workspace config and pnpm-workspace.yaml listing `packages/*`
- [x] T002 Create .nvmrc (Node 20), .gitignore (node_modules, dist, .env, config.local.json), and .env.example per quickstart.md
- [x] T003 [P] Initialize server package with package.json, tsconfig.json, and dependencies (typescript, express, @trpc/server, dotenv) in packages/server/
- [x] T004 [P] Initialize client package with Vite + React + TypeScript scaffold, tsconfig.json, and dependencies (@trpc/client, @trpc/react-query, @tanstack/react-query, @tanstack/react-table, react-router, tailwindcss) in packages/client/
- [x] T005 Create tsconfig.base.json at root with strict mode, shared compiler options, and project references
- [x] T006 [P] Configure ESLint and Prettier across both packages with root config files
- [x] T007 [P] Initialize shadcn/ui in client package and install base components (Table, Tooltip, Collapsible, Badge, Button, Select, Dialog) in packages/client/
- [x] T008 Add root-level pnpm scripts: dev (runs both), build, start, test, lint, typecheck

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types, tRPC wiring, config service, and app shell that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T009 [P] Define PullRequest, Review, ReviewState, and CheckStatus types per data-model.md in packages/server/src/types/pr.ts
- [x] T010 [P] Define JiraIssue, JiraPriority, JiraIssueRef, and PullRequestRef types per data-model.md in packages/server/src/types/jira.ts
- [x] T011 [P] Define DashboardConfig, TeamMember, and JiraFieldMapping types per data-model.md in packages/server/src/types/config.ts
- [x] T012 [P] Define ReviewStatusResult, AuthorStatus, ReviewerStatus, ReviewerBreakdownEntry, RecommendedAction, and PRGroup types per data-model.md in packages/server/src/types/pr.ts
- [x] T013 Create tRPC instance with context creation (loads config, env vars) in packages/server/src/trpc.ts
- [x] T014 Create root tRPC router (merges github, jira, config sub-routers) in packages/server/src/router.ts
- [x] T015 Create Express server entry point: mount tRPC middleware, serve static client in production, load .env in packages/server/src/index.ts
- [x] T016 Implement config.get and config.update tRPC procedures with JSON file read/write in packages/server/src/routers/config.ts
- [x] T017 Setup tRPC client and QueryClient provider in packages/client/src/trpc.ts
- [x] T018 Create App shell with React Router (routes: /, /activity, /sprint, /epic), tRPC provider, and nav layout in packages/client/src/App.tsx and packages/client/src/main.tsx
- [x] T019 [P] Create shared LoadingIndicator component in packages/client/src/components/shared/LoadingIndicator.tsx
- [x] T020 [P] Create shared ErrorBanner component (displays error message, rate limit reset time) in packages/client/src/components/shared/ErrorBanner.tsx
- [x] T021 [P] Create shared StatusBadge component (color-coded badge with text label) in packages/client/src/components/shared/StatusBadge.tsx
- [x] T022 Configure Vite dev server proxy (API requests to localhost:3000) in packages/client/vite.config.ts

**Checkpoint**: Foundation ready. tRPC client-server connection works. Config can be read/written. App shell renders with routing.

---

## Phase 3: User Story 1 - View My PR Review Status at a Glance (Priority: P1) MVP

**Goal**: Display a grouped table of PRs relevant to the viewer with review status indicators, CI status, and age. GitHub-only data (no Jira yet).

**Independent Test**: Load the dashboard with valid GitHub credentials. Verify PRs appear in "My PRs" and "PRs I'm Reviewing" groups with accurate review status, CI status, and age columns.

### Implementation for User Story 1

- [x] T023 [P] [US1] Implement GitHub GraphQL client (auth, request, rate limit tracking) in packages/server/src/services/github/client.ts
- [x] T024 [P] [US1] Define GraphQL query for team PR search with aliases per team member, including reviews, statusCheckRollup, labels, headRefOid, and pushedAt in packages/server/src/services/github/queries.ts
- [x] T025 [US1] Implement GitHub response-to-PullRequest transforms (map GraphQL response to typed PullRequest entities) in packages/server/src/services/github/transforms.ts
- [x] T026 [US1] Implement github.getTeamPRs tRPC procedure per contract (reads config for team members and orgs, calls GitHub GraphQL, returns typed PRs with rate limit info) in packages/server/src/routers/github.ts
- [x] T027 [US1] Implement review status computation logic (Author Status FR-041 and Reviewer Status FR-042 with parentheticals and reviewer breakdown) per data-model.md state transition flow in packages/server/src/logic/review-status.ts
- [x] T028 [US1] Implement PR grouping logic (4 default groups with priority-based dedup per FR-014) in packages/server/src/logic/grouping.ts
- [x] T029 [P] [US1] Define PR table column definitions (title, repo, author, age, review status, CI status, draft state) with TanStack Table columnHelper in packages/client/src/components/pr-table/columns.tsx
- [x] T030 [P] [US1] Implement ReviewStatusCell component (status badge + parenthetical + action text + tooltip with reviewer breakdown) in packages/client/src/components/pr-table/ReviewStatusCell.tsx
- [x] T031 [P] [US1] Implement GroupHeader component (group label, PR count, collapsible) in packages/client/src/components/pr-table/GroupHeader.tsx
- [x] T032 [US1] Implement PRTable component using TanStack Table with grouped rows, semantic HTML table, and column rendering in packages/client/src/components/pr-table/PRTable.tsx
- [x] T033 [US1] Create PR Reviews route view: fetch github.getTeamPRs, compute review status per viewer, group PRs, render PRTable in packages/client/src/routes/pr-reviews.tsx

**Checkpoint**: Dashboard shows GitHub PRs in two groups ("My PRs", "PRs I'm Reviewing") with review status indicators. No Jira data yet.

---

## Phase 4: User Story 3 - Jira Issue Correlation (Priority: P1)

**Goal**: Fetch Jira sprint issues and correlate them with PRs via the Git Pull Request custom field. Display Jira columns (issue key, type, priority, state, assignee) alongside PR data.

**Independent Test**: Verify that PRs with known Jira links display correct issue metadata. PRs without Jira links show empty Jira columns.

**Dependencies**: Requires Phase 2 (types) and Phase 3 (PR table exists to add Jira columns to)

### Implementation for User Story 3

- [x] T034 [P] [US3] Implement Jira field mapping (semantic name to custom field ID lookup from config) in packages/server/src/services/jira/field-map.ts
- [x] T035 [P] [US3] Implement Jira REST client (Bearer auth, base URL construction, request with rate limit header tracking, error handling for 401/429) in packages/server/src/services/jira/client.ts
- [x] T036 [US3] Implement JQL query builders (sprint issues by project/component, epic issues, sprint discovery via openSprints()) in packages/server/src/services/jira/queries.ts
- [x] T037 [US3] Implement Jira response-to-JiraIssue transforms (map REST response with custom field IDs to typed JiraIssue entities, parse comma-separated PR URLs from Git Pull Request field) in packages/server/src/services/jira/transforms.ts
- [x] T038 [US3] Implement jira.getSprintIssues tRPC procedure per contract (discovers active sprint, fetches issues, returns typed JiraIssues with parsed PR URLs) in packages/server/src/routers/jira.ts
- [x] T039 [US3] Add Jira columns (issue key with link, type icon, priority icon, state, assignee) to PR table column definitions in packages/client/src/components/pr-table/columns.tsx
- [x] T040 [US3] Implement PR-to-Jira correlation: match Jira issue linkedPRUrls to fetched PRs, populate PullRequest.linkedJiraIssues in packages/client/src/routes/pr-reviews.tsx

**Checkpoint**: PRs that have linked Jira issues show Jira metadata columns. Jira sprint data enables "Sprint Review" and "No Jira" groups from US1.

---

## Phase 5: User Story 2 - Progressive Loading with GitHub First (Priority: P1)

**Goal**: GitHub data renders immediately. Jira data loads afterward with loading indicators. Newly discovered PRs from Jira trigger a cascade fetch.

**Independent Test**: Load the dashboard and observe GitHub data appearing first, then Jira columns populating, then any cascade PRs appearing.

**Dependencies**: Requires Phase 3 (GitHub data) and Phase 4 (Jira data)

### Implementation for User Story 2

- [x] T041 [US2] Implement github.getPRsByUrls tRPC procedure per contract (parses PR URLs to owner/repo/number, fetches via GraphQL, returns typed PRs) in packages/server/src/routers/github.ts
- [x] T042 [US2] Implement useProgressiveData hook: orchestrate 3-phase cascade (GitHub first, Jira second, cascade GitHub third) using tRPC query enabled flags in packages/client/src/hooks/useProgressiveData.ts
- [x] T043 [US2] Add cell-level loading indicators for Jira columns while Jira data is fetching, and row-level loading for cascade PRs in packages/client/src/components/pr-table/PRTable.tsx
- [x] T044 [US2] Display per-source last-refreshed timestamps (GitHub fetchedAt, Jira fetchedAt) in the PR Reviews route header in packages/client/src/routes/pr-reviews.tsx

**Checkpoint**: Full progressive loading works: GitHub data fast, Jira cascades in, new PRs discovered via Jira load their GitHub metadata.

---

## Phase 6: User Story 4 - Recommended Actions (Priority: P1)

**Goal**: Display a prioritized Recommended Actions panel above the table, derived from review status rules. Actions sorted by Jira priority then PR age.

**Independent Test**: Create PRs in known review states and verify correct actions appear in priority order in the collapsible panel.

**Dependencies**: Requires Phase 3 (review status computation)

### Implementation for User Story 4

- [x] T045 [US4] Implement recommended actions derivation: filter PRs with actionable review status (exclude Wait/No action), sort by Jira priority then age, build RecommendedAction list in packages/server/src/logic/recommended-actions.ts
- [x] T046 [US4] Implement ActionsPanel collapsible component (expanded by default, lists actions with status badge, PR link, action text, repo name) in packages/client/src/components/actions-panel/ActionsPanel.tsx
- [x] T047 [US4] Integrate ActionsPanel into PR Reviews route above the table, passing computed actions from review status + Jira priority data in packages/client/src/routes/pr-reviews.tsx

**Checkpoint**: All P1 stories complete. Dashboard shows PRs with review status, Jira correlation, progressive loading, and recommended actions.

---

## Phase 7: User Story 5 - Auto-Refresh with Toggle and Manual Refresh (Priority: P2)

**Goal**: Automatic polling on a configurable interval with toggle and manual refresh button. Last-refreshed timestamp always visible.

**Independent Test**: Enable auto-refresh, verify data updates on schedule, toggle off, verify polling stops, use manual refresh button.

### Implementation for User Story 5

- [x] T048 [US5] Implement useAutoRefresh hook (manages auto-refresh toggle state, returns refetchInterval value or false, provides manual refetch callback) in packages/client/src/hooks/useAutoRefresh.ts
- [x] T049 [US5] Implement RefreshControls component (auto-refresh toggle switch, manual refresh button, last-refreshed timestamp display) in packages/client/src/components/controls/RefreshControls.tsx
- [x] T050 [US5] Integrate RefreshControls into PR Reviews route and wire auto-refresh interval to tRPC query refetchInterval option in packages/client/src/routes/pr-reviews.tsx

**Checkpoint**: Dashboard auto-refreshes, toggle works, manual refresh works, timestamps visible.

---

## Phase 8: User Story 6 - Grouping, Sorting, and Filtering Options (Priority: P2)

**Goal**: User can change grouping (default, by repo, by epic, by priority, flat), sorting (age, priority, review status, CI), and filtering (repo, action needed, draft, review state). State persisted in URL.

**Independent Test**: Change grouping, sorting, and filter options and verify table reorganizes correctly. Reload page and verify state is preserved from URL.

### Implementation for User Story 6

- [x] T051 [P] [US6] Implement URL state serialization helpers (parse/stringify groupBy, sortBy, filters, columns, stale settings to/from URLSearchParams) in packages/client/src/lib/url-state.ts
- [x] T052 [US6] Implement useViewState hook (reads URL search params via React Router useSearchParams, returns typed view state, provides setters that update URL) in packages/client/src/hooks/useViewState.ts
- [x] T053 [P] [US6] Implement GroupBySelector component (dropdown: Default, Repository, Epic, Priority, Flat) in packages/client/src/components/controls/GroupBySelector.tsx
- [x] T054 [P] [US6] Implement FilterBar component (repo multi-select, action needed toggle, draft toggle, review state filter) in packages/client/src/components/controls/FilterBar.tsx
- [x] T055 [US6] Implement ColumnCustomizer modal (column visibility toggles, drag-to-reorder, per-view persistence, includes all Jira columns per FR-037) in packages/client/src/components/controls/ColumnCustomizer.tsx
- [x] T056 [US6] Wire grouping, sorting, filtering, and column customization into PRTable via TanStack Table APIs and useViewState hook in packages/client/src/components/pr-table/PRTable.tsx and packages/client/src/routes/pr-reviews.tsx

**Checkpoint**: All grouping/sorting/filtering controls work. URL state persists across page reloads.

---

## Phase 9: User Story 7 - View as Another Team Member or Whole Team (Priority: P2)

**Goal**: Perspective selector to view as any team member or whole team. Review status and grouping adapt to the selected perspective.

**Independent Test**: Select a teammate and verify table reflects their PR activity. Select "Whole Team" and verify combined view without My/Reviewing split.

### Implementation for User Story 7

- [x] T057 [US7] Implement PerspectiveSelector component (dropdown listing all team members from config + "Whole Team" option, syncs with URL state) in packages/client/src/components/controls/PerspectiveSelector.tsx
- [x] T058 [US7] Update review status computation and PR grouping to accept perspective parameter (viewer username or "team") in packages/client/src/routes/pr-reviews.tsx
- [x] T059 [US7] Update grouping logic for "Whole Team" perspective (flat or repo-grouped without My/Reviewing split) in packages/server/src/logic/grouping.ts

**Checkpoint**: All P2 stories complete. Dashboard supports refresh controls, flexible grouping/filtering, and perspective switching.

---

## Phase 10: User Story 8 - Activity Timeline View (Priority: P3)

**Goal**: Chronological timeline view showing GitHub and Jira events grouped by day with source indicators and adjustable time window.

**Independent Test**: Switch to Activity Timeline view and verify events from both sources appear in correct chronological order grouped by day.

### Implementation for User Story 8

- [x] T060 [P] [US8] Define ActivityEvent and ActivityActionType types per data-model.md in packages/server/src/types/activity.ts
- [x] T061 [P] [US8] Implement github.getActivity tRPC procedure (fetch PR events for user within time window via GitHub GraphQL) in packages/server/src/routers/github.ts
- [x] T062 [P] [US8] Implement jira.getActivity tRPC procedure (fetch issue changelog and comments for user within time window via Jira REST with expand=changelog) in packages/server/src/routers/jira.ts
- [x] T063 [US8] Create Activity Timeline route view: fetch both activity sources, merge and sort chronologically, group by day, render with source indicators and time window selector in packages/client/src/routes/activity-timeline.tsx

**Checkpoint**: Activity Timeline view shows merged GitHub + Jira events grouped by day.

---

## Phase 11: User Story 9 - Sprint Status View (Priority: P3)

**Goal**: Sprint-focused view showing all sprint issues grouped by Jira status with linked PR metadata. Uses Jira-primary progressive loading.

**Independent Test**: Switch to Sprint Status view and verify issues appear grouped by status with correct PR linkage and review status.

**Dependencies**: Requires Phase 4 (Jira service) and Phase 5 (getPRsByUrls for cascade)

### Implementation for User Story 9

- [x] T064 [US9] Create Sprint Status route view with Jira-primary progressive loading: fetch jira.getSprintIssues first, then github.getPRsByUrls for linked PRs, group issues by Jira status, display with PR metadata columns in packages/client/src/routes/sprint-status.tsx
- [x] T065 [US9] Add story points and original story points columns to Sprint Status table, display Jira issue as primary row with linked PRs as sub-rows per FR-040 in packages/client/src/routes/sprint-status.tsx

**Checkpoint**: Sprint Status view shows sprint issues with PR linkage.

---

## Phase 12: User Story 10 - Epic Status View (Priority: P3)

**Goal**: Epic-focused view showing all issues in a selected epic across sprints with a toggle to hide Closed/Resolved issues.

**Independent Test**: Select an epic and verify all its issues appear with sprint and PR metadata. Toggle hide Closed and verify.

**Dependencies**: Requires Phase 4 (Jira service) and Phase 11 (Sprint Status pattern to reuse)

### Implementation for User Story 10

- [x] T066 [US10] Implement jira.getEpicIssues tRPC procedure per contract (JQL for epic issues including sub-tasks, optional closed filter) in packages/server/src/routers/jira.ts
- [x] T067 [US10] Create Epic Status route view: epic selector (populated from sprint issues' epics), fetch jira.getEpicIssues, cascade github.getPRsByUrls, display issues with PR metadata and Closed/Resolved toggle in packages/client/src/routes/epic-status.tsx

**Checkpoint**: All P3 stories complete. All four views (PR Reviews, Activity Timeline, Sprint Status, Epic Status) are functional.

---

## Phase 13: Polish & Cross-Cutting Concerns

**Purpose**: Resilience, edge cases, accessibility, and validation

- [x] T068 Add error boundaries per data source: continue displaying cached data on failure, show ErrorBanner with rate limit reset time (FR-023, FR-024) in packages/client/src/routes/pr-reviews.tsx
- [x] T069 [P] Add blocked indicator with tooltip (FR-033) and toggleable stale PR highlighting with age cutoff (FR-034) to PR table column definitions in packages/client/src/components/pr-table/columns.tsx
- [x] T070 [P] Add empty state messages for all table groups and filter results (edge case: no PRs match filters) in packages/client/src/components/pr-table/PRTable.tsx
- [x] T071 Validate URL state persistence (FR-038): verify all view state round-trips through URL across all views
- [x] T072 Accessibility audit: verify keyboard navigation, ARIA labels on all interactive elements, screen reader compatibility, and color-is-not-sole-conveyor across all views
- [x] T073 Run quickstart.md validation: follow setup steps on a clean environment, verify all scripts work

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational - GitHub data + PR table
- **US3 (Phase 4)**: Depends on Foundational + US1 (adds Jira columns to existing table)
- **US2 (Phase 5)**: Depends on US1 + US3 (progressive loading integrates both data sources)
- **US4 (Phase 6)**: Depends on US1 (review status computation)
- **US5 (Phase 7)**: Depends on Foundational only (refresh controls are view-independent)
- **US6 (Phase 8)**: Depends on US1 (grouping/filtering operates on the PR table)
- **US7 (Phase 9)**: Depends on US1 (perspective changes review status + grouping)
- **US8 (Phase 10)**: Depends on Foundational only (new view, new tRPC procedures)
- **US9 (Phase 11)**: Depends on US3 + US2 (Jira service + getPRsByUrls for cascade)
- **US10 (Phase 12)**: Depends on US3 (Jira service + epic procedure)
- **Polish (Phase 13)**: Depends on all desired user stories being complete

### User Story Dependencies

```
Setup → Foundational → US1 → US3 → US2 (cascade integration)
                         ↓        ↘
                        US4     US9, US10
                         ↓
                     US5, US6, US7 (can run in parallel after US1)

Foundational → US8 (independent — new view, no table dependency)
```

### Within Each User Story

- Server-side logic before client-side UI
- Types/transforms before tRPC procedures
- tRPC procedures before client components
- Components before route-level integration

### Parallel Opportunities

- **Phase 1**: T003, T004 (server/client init) in parallel; T006, T007 (lint, shadcn) in parallel
- **Phase 2**: T009-T012 (all type definitions) in parallel; T019-T021 (shared components) in parallel
- **Phase 3**: T023, T024 (GitHub client + queries) in parallel; T029-T031 (column defs, cells, headers) in parallel
- **Phase 4**: T034, T035 (field map + Jira client) in parallel
- **Phase 6**: T051, T053, T054 (URL helpers, GroupBy, FilterBar) in parallel
- **Phase 10**: T060-T062 (activity types + both activity procedures) in parallel
- **After US1**: US4, US5, US6, US7 can run in parallel (different files, no cross-dependencies)
- **After US3**: US8, US9, US10 can run in parallel

---

## Parallel Example: User Story 1

```
# Launch server-side tasks in parallel:
T023: "Implement GitHub GraphQL client in packages/server/src/services/github/client.ts"
T024: "Define GraphQL queries for team PRs in packages/server/src/services/github/queries.ts"

# After T023+T024 complete, T025 (transforms) then T026 (procedure)

# Launch client components in parallel (after T026):
T029: "Define PR table column definitions in packages/client/src/components/pr-table/columns.tsx"
T030: "Implement ReviewStatusCell in packages/client/src/components/pr-table/ReviewStatusCell.tsx"
T031: "Implement GroupHeader in packages/client/src/components/pr-table/GroupHeader.tsx"

# After all components: T032 (PRTable) then T033 (route)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Dashboard shows GitHub PRs with review status in two groups
5. Demo: Core value proposition is testable

### P1 Delivery (User Stories 1-4)

1. Setup + Foundational → Foundation ready
2. US1 → GitHub PR table with review status → Test independently
3. US3 → Jira correlation + sprint-based groups → Test independently
4. US2 → Progressive loading integration → Test independently
5. US4 → Recommended Actions panel → Test independently
6. **STOP and VALIDATE**: All P1 stories complete, dashboard is actionable

### Full MVP Delivery

1. P1 stories complete → Core dashboard working
2. US5 + US6 + US7 in parallel → Refresh, controls, perspectives
3. US8 + US9 + US10 in parallel → Alternate views
4. Polish → Resilience, accessibility, validation
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in the same phase
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable after its checkpoint
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- The review status computation (T027) is the most complex single task — it implements the full FR-041/FR-042 state machine with parentheticals
