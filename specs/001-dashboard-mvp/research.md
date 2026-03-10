# Research: PR Reviews Dashboard MVP

**Branch**: `001-dashboard-mvp` | **Date**: 2026-03-10

## R1: Project Structure — Monorepo vs Single Package

**Decision**: npm workspaces monorepo with two packages (`packages/server`, `packages/client`)

**Rationale**: The project has a clear client/server split with tRPC bridging them. npm workspaces provide workspace-level dependency management without requiring Turborepo or Nx overhead. The tRPC router types are shared via TypeScript project references.

**Alternatives considered**:
- Single `src/` directory with co-located client/server: rejected because Vite's dev server and the tRPC backend server are separate processes with different entry points. Separating packages makes build/dev scripts clearer.
- Turborepo/Nx: rejected per Constitution III (Simplicity). Two packages don't need task orchestration or build caching. Can be added later if needed.

## R2: Package Manager

**Decision**: pnpm 9.x

**Rationale**: Better workspace support than npm, faster installs, disk-efficient via content-addressable storage. Widely adopted in the TypeScript ecosystem.

**Alternatives considered**:
- npm: functional but slower, less efficient disk usage for workspaces.
- bun: fast but less mature ecosystem support for some tooling (e.g. some Vite plugins).

## R3: Server Runtime

**Decision**: Express 5.x with `@trpc/server` HTTP adapter

**Rationale**: Express is the most mature, widely-documented Node.js server. The dashboard is a simple localhost app — performance differences between Express and Fastify are irrelevant at this scale. Express also serves the Vite-built static frontend in production mode. tRPC's Express adapter (`createExpressMiddleware`) is well-supported.

**Alternatives considered**:
- Fastify: better performance but unnecessary for a single-user localhost app. Adds complexity without benefit (Constitution III).
- Standalone tRPC server: lacks middleware ecosystem for serving static files.

## R4: Styling Approach

**Decision**: Tailwind CSS 4.x + shadcn/ui components

**Rationale**: shadcn/ui provides accessible, composable UI primitives built on Radix UI, styled with Tailwind. Components are installed as source code (not a dependency), giving full control. Excellent table primitives that integrate with @tanstack/react-table. Meets Constitution IV (Accessible UI) out of the box — Radix components handle ARIA attributes, keyboard navigation, and focus management.

**Alternatives considered**:
- CSS modules: more manual work for a data-dense dashboard with many interactive components.
- PatternFly: heavyweight design system, overkill for a personal tool.

## R5: Table Library

**Decision**: @tanstack/react-table 8.x

**Rationale**: Headless table library with built-in support for column visibility/reordering, row grouping, sorting, filtering, and pagination. Exactly matches FR-013 through FR-017 requirements. Works seamlessly with shadcn/ui table primitives. Type-safe column definitions with TypeScript.

**Alternatives considered**:
- Custom table: significant effort to build grouping, sorting, filtering, and column customization from scratch.
- AG Grid: commercial license, overkill for a personal dashboard.

## R6: Client State Management

**Decision**: URL search params as primary UI state + tRPC for server state

**Rationale**: FR-038 requires all view state to be encoded in URL query strings. This means the URL is the source of truth for grouping, sorting, filtering, perspective, column selection, and stale highlighting. React Router's `useSearchParams` or a lightweight URL state hook reads/writes these params. tRPC's React integration (`@trpc/react-query`) wraps @tanstack/react-query internally, providing caching, loading states, and polling via typed hooks like `trpc.github.getTeamPRs.useQuery()`. No additional state library needed — tRPC is the only server state layer.

**Alternatives considered**:
- Zustand: adds a separate state store that must be synced with URL params — introduces a synchronization problem. Since the URL is the mandated source of truth (FR-038), deriving state directly from URL params is simpler.
- Jotai: same synchronization concern as Zustand.

## R7: Router

**Decision**: React Router 7.x with `useSearchParams`

**Rationale**: Mature, well-documented router. The dashboard has only a handful of routes (PR Reviews, Activity Timeline, Sprint Status, Epic Status). React Router's `useSearchParams` hook provides direct access to URL query parameters for view state persistence (FR-038). No need for the complexity of TanStack Router's type-safe search params for this use case.

**Alternatives considered**:
- TanStack Router: type-safe URL params are appealing but adds learning curve and is less mature than React Router. The dashboard's URL params are simple key-value pairs that don't need schema validation.

## R8: GitHub API Strategy

**Decision**: GitHub GraphQL API as primary, with batched alias queries

**Rationale**: The dashboard needs to fetch PR data for ~20 team members across multiple organizations. GraphQL supports batching multiple search queries in a single request using aliases, dramatically reducing round trips. A single batched query fetches all team PRs with review details, CI status, and labels in one request (~100-150 points out of 15,000/hour budget).

Key GraphQL capabilities used:
- `search(query: "is:pr is:open author:username org:org1 org:org2")` with aliases for each team member
- `reviews` connection for per-reviewer state, timestamps, and commit SHAs
- `statusCheckRollup` for combined CI status
- `labels` for lgtm/approved detection
- Commit SHA comparison between review commit and HEAD for "new commits since review" detection

**Rate limit budget**: 15,000 points/hour. At ~150 points per full sync, the dashboard can refresh every 30 seconds without concern. GitHub REST search API (30 req/min) would be a bottleneck.

**Alternatives considered**:
- REST API: would require 50+ sequential requests per sync for 20 team members. Search API rate limit (30/min) is too restrictive.
- Hybrid REST+GraphQL: unnecessary complexity — GraphQL handles all needed queries.

## R9: Jira API Strategy

**Decision**: Jira Datacenter REST API v3 with JQL-based batch queries, behind a portability abstraction layer

**Rationale**: Jira Datacenter's REST API supports JQL queries that return multiple issues per request, minimizing round trips. All custom field IDs are already documented (see jira-mcp.md). The abstraction layer (FR-026/FR-027) maps semantic field names to custom field IDs via configuration, enabling Jira Cloud migration without changing application code.

Key API patterns:
- Sprint discovery: `sprint in openSprints()` JQL function
- Sprint issues: `project = {key} AND sprint = {sprintId}` with field selection
- PR correlation: Parse `customfield_12310220` (Git Pull Request) field — comma-separated PR URLs
- Epic issues: `"Epic Link" = {epicKey}` JQL
- Activity: `expand=changelog` on issue fetch for status transitions

**Authentication**: Bearer token via `Authorization: Bearer {JIRA_TOKEN}` header.

**Rate limit strategy**: 5-minute minimum polling interval (per spec assumption). Batch JQL queries to minimize requests. Monitor `X-RateLimit-*` headers and implement exponential backoff on 429 responses.

**Custom field configuration**: Field IDs stored in local config file, referenced by semantic name in application code. This supports both Datacenter-to-Cloud migration and deployment to different Jira instances.

| Semantic Name | Datacenter Field ID | Format |
|---------------|-------------------|--------|
| gitPullRequest | `customfield_12310220` | String (comma-separated URLs) |
| sprint | `customfield_12310940` | String (parse for ID) |
| storyPoints | `customfield_12310243` | Integer or null |
| originalStoryPoints | `customfield_12314040` | Numeric or null |
| epicLink | `customfield_12311140` | String (epic key) |
| blocked | `customfield_12316543` | Object `{"value": "True"}` |
| blockedReason | `customfield_12316544` | String |

**Alternatives considered**:
- Jira Cloud API from the start: premature — the team currently uses Datacenter. Build for Datacenter with clean abstraction.

## R10: "New Commits Since Review" Detection

**Decision**: Compare review's commit SHA with PR HEAD SHA via GraphQL

**Rationale**: Each GitHub review object includes the `commit.oid` it was submitted against. Comparing this against the PR's `headRefOid` (latest commit SHA) determines if new commits exist. If they differ, count commits after the review's `submittedAt` timestamp to provide context (e.g. "3 new commits since your review").

**Implementation approach**:
1. Fetch PR with `reviews { nodes { author state submittedAt commit { oid } } }` and `headRefOid`
2. For each reviewer, compare their latest review's `commit.oid` against `headRefOid`
3. If different → new commits since that review
4. Count commits between review commit and HEAD for the parenthetical

## R11: "New Comments Since Last Push" Detection

**Decision**: Compare comment timestamps against PR's `pushedAt` field

**Rationale**: GitHub PR objects include a `pushedAt` timestamp (last push to the PR branch). Review comments have `createdAt` timestamps. Comments where `createdAt > pushedAt` are "new since last push". This drives the "New Feedback" author status (FR-041).

**Implementation approach**:
1. Fetch PR `pushedAt` timestamp
2. Fetch all review comments with `createdAt`
3. Filter comments where `createdAt > pushedAt`
4. Count for the parenthetical (e.g. "2 new reviews since last push")

## R12: Progressive Loading Architecture

**Decision**: Two-phase fetch with cascading queries, managed by tRPC procedures

**Rationale**: The spec requires GitHub data first, then Jira data, then additional GitHub data for newly discovered PRs (FR-005, FR-006, FR-007). This maps to three tRPC queries that the client calls sequentially:

1. **Phase 1 (GitHub primary)**: Fetch all team PRs via GitHub GraphQL. Client renders immediately.
2. **Phase 2 (Jira cascade)**: Fetch sprint issues via Jira JQL. Match PR URLs from `customfield_12310220` to known PRs. Client updates with Jira columns.
3. **Phase 3 (GitHub cascade)**: For any new PRs discovered via Jira (not in Phase 1 results), fetch their GitHub metadata. Client updates with new rows.

Each phase uses separate tRPC queries. The client manages sequencing with `enabled` flags on @tanstack/react-query hooks (query 2 enabled when query 1 succeeds, etc.).

For Jira-primary views (Sprint Status, Epic Status), the phase order is reversed: Jira first, then GitHub cascade.

## R13: Testing Strategy

**Decision**: Vitest for all tests + React Testing Library for UI + MSW for API mocking

**Rationale**: Vitest integrates natively with Vite's config and transform pipeline. React Testing Library tests UI behavior rather than implementation. MSW (Mock Service Worker) intercepts HTTP requests at the network level, enabling realistic tests of tRPC procedures and GitHub/Jira API interactions.

Test categories (per Constitution V — Test at Boundaries):
- **tRPC router tests**: Input validation, data transformation, error handling. Mock GitHub/Jira APIs with MSW.
- **UI interaction tests**: Rendering data/loading/error states, filter/sort interactions, perspective switching. Mock tRPC client.
- **Review status logic tests**: Unit tests for the rule engine that computes Author Status (FR-041) and Reviewer Status (FR-042) from PR data.
- **E2E tests**: Reserved for critical flows only (initial page load + progressive loading).

**Alternatives considered**:
- Jest: works but requires separate configuration from Vite. Vitest is purpose-built for Vite projects.
- Playwright: reserved for E2E only, not needed for MVP boundary tests.
