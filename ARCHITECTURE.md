# Architecture

This document explains the structure and design of the PR Reviews Dashboard -- a full-stack TypeScript application that aggregates GitHub PR data with Jira issue metadata into a unified local web dashboard.

For setup instructions, see [SETUP.md](SETUP.md). For a feature overview, see [README.md](README.md).

## High-Level Overview

The app is a **pnpm monorepo** with two packages: a tRPC + Express backend and a React + Vite frontend. All data stays local -- the server proxies GitHub and Jira APIs and applies business logic, while the client renders the dashboard UI. There is no database; the only persistence is a `config.local.json` file and a 60-second in-memory TTL cache.

```
                          +-------------------+
                          |   GitHub GraphQL  |
                          |       API         |
                          +--------+----------+
                                   |
+-------------------+     +--------+----------+     +-------------------+
|   React Client    |<--->|   Express Server  |<--->|   Jira REST API   |
|   (Vite, port     |tRPC |   (port 3000)     |     |                   |
|    5173 in dev)    |     +-------------------+     +-------------------+
+-------------------+
```

In production, the server serves both the API and the static client build on a single port.

## Project Structure

```
pr-reviews-dashboard/
  packages/
    server/src/
      index.ts              # Express entry point, static file serving
      router.ts             # Root tRPC router (merges sub-routers)
      trpc.ts               # tRPC context creation & error formatting
      routers/
        github.ts           # GitHub API procedures (getTeamPRs, getPRsByUrls, etc.)
        jira.ts             # Jira API procedures (getSprintIssues, getEpicIssues, etc.)
        config.ts           # Configuration read/write procedures
      services/
        github/
          client.ts         # GraphQL client with rate limit tracking
          queries.ts        # GraphQL query builders (PR_FRAGMENT, search queries)
          transforms.ts     # Response transforms (PR nodes -> typed PullRequest)
        jira/
          client.ts         # REST client with rate limit tracking
          queries.ts        # JQL query builders
          transforms.ts     # Response transforms (issue JSON -> typed JiraIssue)
          field-map.ts      # Custom field ID mappings
        config.ts           # Config file I/O (config.local.json)
        cache.ts            # In-memory TTL cache (60s default)
      logic/
        review-status.ts    # Review status computation (perspective-dependent)
        grouping.ts         # PR grouping into priority buckets
        recommended-actions.ts  # Prioritized action derivation

      types/
        pr.ts               # PullRequest, Review, ReviewStatusResult types
        jira.ts             # JiraIssue types
        config.ts           # DashboardConfig, TeamMember types
        activity.ts         # ActivityEvent types
        index.ts            # Type re-exports
    client/src/
      main.tsx              # React entry point
      App.tsx               # Providers, router, nav bar
      trpc.ts               # tRPC client (httpBatchLink to /trpc)
      routes/
        overview.tsx        # Overview dashboard (responsive card grid)
        pr-reviews.tsx      # Main PR dashboard (filters, grouping, actions)
        sprint-status.tsx   # Jira sprint view with PR correlation
        epic-status.tsx     # Epic issue browser with PR correlation
        activity-timeline.tsx  # Unified GitHub + Jira activity feed
      hooks/
        useOverviewData.ts        # Overview tab data orchestration
        useProgressiveData.ts     # 3-phase data loading orchestration
        useAutoRefreshContext.tsx  # Auto-refresh interval management
        useDetailModal.ts         # Detail modal state access
        useViewState.ts           # URL-based view state serialization
        useTheme.ts               # Theme persistence (light/dark/system)
        useFontSize.ts            # Font size control
        useJiraHost.ts            # Jira host from config
      components/
        overview/           # Overview tab card components
        pr-table/           # PR table rendering (columns, rows, badges)
        jira-table/         # Jira issue table rendering (shared cells in cells.tsx)
        actions-panel/      # Recommended actions panel + "How It Works"
        detail-modal/       # PR/Jira detail modals, diff viewer
        controls/           # Filter bar, grouping, refresh, column customizer
        shared/             # Common UI components
        ui/                 # shadcn/ui primitives (Button, Dialog, etc.)
      lib/
        bot-users.ts        # Bot username set for filtering
        url-state.ts        # URL query param serialization
        utils.ts            # General utilities
```

## Data Flow

### Three-Phase Progressive Loading

The main PR Reviews route uses a cascade loading strategy orchestrated by the `useProgressiveData` hook:

```
Phase 1: GitHub PRs         Phase 2: Jira Sprint         Phase 3: Cascade PRs
  github.getTeamPRs    ->    jira.getSprintIssues    ->    github.getPRsByUrls
  (team member search)       (active sprint issues)        (PRs linked from Jira
                                                            not found in Phase 1)
```

**Phase 1** searches GitHub for open PRs authored by or requesting review from team members across configured GitHub organizations. Uses GraphQL aliases to parallelize multiple member searches in a single request.

**Phase 2** discovers the active sprint by matching the team name in sprint labels, then fetches all issues in that sprint. Runs in parallel with Phase 1.

**Phase 3** (cascade) examines Jira issues for linked PR URLs not already found in Phase 1, and fetches those PRs. This catches PRs from non-team-member authors that are linked to team sprint issues.

After all phases complete, PRs and Jira issues are correlated by matching PR URLs in Jira's Git Pull Request custom field.

### Request Flow

```
Client Route
  -> tRPC React Query hook (with caching)
    -> httpBatchLink to /trpc
      -> Express middleware
        -> tRPC router procedure
          -> Service layer (API client)
            -> GitHub GraphQL / Jira REST
          <- Response transform
        <- Typed result with rate limit info
      <- JSON response
    <- React Query cache
  <- Render with data
```

## Business Logic

The three files in `packages/server/src/logic/` contain the core decision-making logic. These are imported by the client-side route components.

### Review Status (`logic/review-status.ts`)

Computes a context-aware status for each PR based on the viewer's relationship to it. The same PR produces different statuses depending on whether you authored it or are reviewing it.

**Author perspective:** New Feedback (P0), CI Failing (P1), WIP (P4), Approved/Ready to Merge (P5), Has LGTM (P3), Awaiting Review (null).

**Reviewer perspective:** My Re-review Needed (P2), Needs First Review (P3), I'm Mentioned (P3), Team Re-review Needed (P3), Needs Additional Review (P3), Awaiting Changes (null), Approved (P5), WIP (null).

Key mechanics:
- **Review staleness** is determined by comparing the review's commit OID against the PR's latest commit. A review on an older commit is "stale" (author pushed new code since).
- **Bot filtering** excludes bot reviews from status computation but keeps them in the review timeline.
- **Mentioned users** are extracted from PR comments via `@username` regex.

### PR Grouping (`logic/grouping.ts`)

Distributes PRs into four priority-ordered groups: My PRs, PRs I'm Reviewing, Sprint Review PRs, Team PRs with No Jira. Each PR appears in exactly one group (highest-priority match wins).

### Recommended Actions (`logic/recommended-actions.ts`)

Derives a sorted list of action items from review statuses. Sorting uses four tiebreakers: action priority (P0-P5), status sub-priority (e.g. "Needs First Review" > "Team Re-review Needed"), Jira priority (Blocker > Critical > Major > Normal > Minor), and PR age (oldest first).

## Server Architecture

### tRPC Context

Every tRPC procedure receives a context containing the loaded `DashboardConfig`, GitHub token, Jira token, and Jira host. The context is created per-request from environment variables and the config file.

### Error Handling

The tRPC error formatter extracts GitHub rate limit information (remaining, limit, reset time) from error causes and includes it in the response, so the client can display rate limit status even on errors.

### Caching

A simple in-memory TTL cache (`services/cache.ts`) wraps API calls with a 60-second expiry. This reduces API load during development and with auto-refresh enabled. There is no cache invalidation mechanism beyond TTL expiry.

### GitHub Integration

Uses the GitHub GraphQL API exclusively (except for PR file diffs, which use the REST API). A `PR_FRAGMENT` defines all fields fetched per PR. Search queries use GraphQL aliases to parallelize multiple member searches in a single request.

Rate limits are tracked from both HTTP headers and GraphQL response bodies. The more reliable `resetAt` timestamp comes from the GraphQL `rateLimit` field.

### Jira Integration

Uses the Jira Cloud REST API v2 with Basic authentication (email + API token). Sprint discovery works by searching for issues in open sprints and matching the team name in sprint labels. Custom field IDs are configurable via `config.local.json` (defaults are for Red Hat's Jira Cloud instance).

Sprint data is parsed from the Cloud format (array of objects with `id`, `name`, `state` fields).

## Client Architecture

### Provider Stack

The app wraps the component tree in providers (defined in `App.tsx`):

1. **tRPC Provider** -- React Query integration with `httpBatchLink`
2. **QueryClient Provider** -- 2-minute stale time, no refetch on window focus
3. **TooltipProvider** -- Radix UI tooltips with no delay
4. **AutoRefreshProvider** -- manages auto-refresh interval shared across views
5. **BrowserRouter** -- React Router v7
6. **DetailModalProvider** -- PR/Jira detail modal state and lazy data loading

### Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `overview.tsx` | Overview dashboard with responsive card grid |
| `/reviews` | `pr-reviews.tsx` | Main PR dashboard with grouping, filtering, actions |
| `/sprint` | `sprint-status.tsx` | Jira sprint view with PR correlation |
| `/epic/:epicKey?` | `epic-status.tsx` | Epic issue browser |
| `/activity` | `activity-timeline.tsx` | Unified GitHub + Jira activity feed |

### URL State

View state (filters, grouping, perspective, column visibility) is serialized to URL query parameters via `useViewState`. This makes views shareable and preserves state across page refreshes.

### Overview Tab

The Overview route (`/`) shows a responsive 2-column card grid (collapsing to 1 column on narrow screens) with 8 summary cards. It reuses `useProgressiveData` for GitHub PRs and Jira sprint data, and adds 3 additional Jira queries via `useOverviewData`:

- **`getMyIssues`** -- epics and issues assigned to the user in New/Backlog/In Progress states
- **`getFilterIssues`** -- issues matching a saved Jira filter (configurable via `teamAreaLabelsFilter`) in Review/Testing states
- **`getWatchedIssues`** -- issues the user is watching (via Jira's `watcher` JQL)

Cards are: My Epics, My Assigned Issues, My PRs, Recommended Review Actions (reuses `ActionsPanel`), PRs I'm Reviewing, Team Issues in Review, Team Issues in Testing, and Other Watched Issues. Issues are deduplicated across cards -- filter-based cards exclude issues assigned to the user, and watched issues exclude everything shown in other cards.

Compact table components (`CompactPRTable`, `CompactJiraTable`) render subset columns with shared cell renderers extracted into `jira-table/cells.tsx`.

### Detail Modal

A global modal system (`DetailModalProvider`) manages a registry of loaded PRs and Jira issues. Clicking any PR or Jira link opens a modal with tabs for PR details, diffs, and linked Jira issues (or vice versa). Missing data is lazy-loaded on demand -- for example, PR file diffs and Jira comments are only fetched when their tabs are opened.

### Theming

Three-way theme toggle (light/dark/system) with full Tailwind CSS color palettes for each mode. Font size has four levels for information density control. Both preferences are persisted to localStorage.

## Key Design Decisions

### Why tRPC?

End-to-end type safety between client and server without code generation. The server defines typed procedures and the client gets full autocomplete and type checking through the `AppRouter` type export. This is particularly valuable in a monorepo where both packages are developed together.

### Why progressive loading with cascade?

The dashboard needs data from two separate APIs (GitHub and Jira) that don't know about each other. Rather than waiting for both to complete before showing anything, the UI renders progressively as each phase completes. The cascade phase is necessary because some relevant PRs are only discoverable through Jira issue links (e.g. PRs from external contributors linked to team sprint issues).

### Why local-only?

The dashboard is designed for individual developer use. All data is fetched on-demand from GitHub and Jira APIs using the user's own tokens. There is no shared backend, no database, and no user accounts. This simplifies deployment (just `pnpm start`) and avoids storing sensitive data.

### Why perspective-dependent statuses?

The same PR needs different treatment depending on your role. As an author, you care about whether reviewers have responded. As a reviewer, you care about whether the author has pushed new commits since your last review. Computing status from the viewer's perspective makes the recommended actions list directly actionable.

### Why in-memory caching instead of a database?

The app is a thin proxy over GitHub and Jira APIs. A 60-second TTL cache reduces API load during auto-refresh cycles without introducing stale data concerns. A database would add complexity without meaningful benefit since the source of truth is always the external APIs.

### Why GraphQL aliases for parallel search?

GitHub's GraphQL API allows sending multiple search queries in a single request using aliases. This is far more efficient than making one REST API call per team member, especially for larger teams. It also keeps rate limit consumption low.

## Type System

Shared types in `packages/server/src/types/` are imported directly by the client (no code generation step). Key types:

- **PullRequest** -- comprehensive PR metadata including reviews, comments, review requests, mentioned users, check status, and linked Jira issues
- **Review** -- reviewer identity, state (APPROVED/CHANGES_REQUESTED/COMMENTED/DISMISSED/PENDING), commit OID for staleness detection
- **ReviewStatusResult** -- computed status with priority, reviewer breakdown, and push dates
- **RecommendedAction** -- derived action with metadata for UI display (icon, timestamps, Jira context)
- **JiraIssue** -- issue metadata with sprint/epic context, story points, blocked flag, linked PR URLs
- **DashboardConfig** -- user/team configuration including team members and custom field mappings
- **ActivityEvent** -- unified event type for both GitHub and Jira activity
