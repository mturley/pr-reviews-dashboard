# Implementation Plan: PR Reviews Dashboard MVP

**Branch**: `001-dashboard-mvp` | **Date**: 2026-03-10 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-dashboard-mvp/spec.md`

## Summary

Build a local-only web dashboard that displays personalized PR review status by combining GitHub PR data with Jira issue metadata. The dashboard uses a React + Vite frontend communicating with a Node.js backend via tRPC, fetching data from GitHub's GraphQL API and Jira Datacenter's REST API. Progressive loading shows GitHub data first, then cascades Jira data, then fetches additional GitHub metadata for newly discovered PRs.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: React 19.x, Vite 6.x, tRPC 11.x (@trpc/react-query wraps @tanstack/react-query internally), @tanstack/react-table 8.x, Express 5.x, Tailwind CSS 4.x, shadcn/ui, React Router 7.x
**Storage**: Local JSON config file for non-secret configuration (team roster, org list, project settings). Environment variables for secrets.
**Testing**: Vitest 1.x, React Testing Library, MSW (Mock Service Worker)
**Target Platform**: localhost web application (Node.js server + browser client)
**Project Type**: Web application (client + server monorepo)
**Performance Goals**: GitHub data visible within 5 seconds (SC-001). Full dashboard with Jira data within 30 seconds (SC-002). Perspective switch within 5 seconds using cached data (SC-004).
**Constraints**: Must not trigger Jira rate limiting during a full workday of polling (SC-006). Single-user, no authentication required. Must work offline for cached data display.
**Scale/Scope**: ~20 team members, ~50-100 open PRs, ~50-100 sprint issues. 4 views (PR Reviews, Activity Timeline, Sprint Status, Epic Status).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. End-to-End Type Safety | PASS | tRPC provides compile-time type checking across client/server boundary. Shared types defined once in server, inferred by client. |
| II. Data Accuracy Over Completeness | PASS | Progressive loading shows loading indicators (FR-008), last-refreshed timestamps (FR-009), and clear error messages (FR-024). Staleness is always communicated. |
| III. Simplicity and YAGNI | PASS | No Turborepo/Nx. URL params as state (no separate state library). Express over Fastify. All decisions favor simplicity. P3 stories (Activity, Sprint, Epic views) are additive — core PR Reviews view works without them. |
| IV. Accessible and Responsive UI | PASS | shadcn/ui built on Radix UI provides accessible primitives (ARIA, keyboard nav, focus management). Tailwind responsive utilities for 768px+ (FR noted). Color is not sole information conveyor — status text + icons accompany color coding. |
| V. Test at Boundaries | PASS | Testing strategy covers tRPC router handlers, UI state rendering, and review status rule engine. MSW mocks API boundaries. E2E reserved for critical flows only. |

### Post-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. End-to-End Type Safety | PASS | Data model types defined in `packages/server/src/types/`, inferred by client via tRPC router type export. Jira field mapping is configuration-driven but type-safe (mapped to typed interfaces). |
| II. Data Accuracy Over Completeness | PASS | Three-phase progressive loading (R12) with per-source timestamps. Error boundaries per data source allow partial display. |
| III. Simplicity and YAGNI | PASS | 2 packages (not 3+). No ORM — direct API calls with typed responses. Review status is rule-based (FR-032), no ML. Config file is plain JSON. |
| IV. Accessible and Responsive UI | PASS | Table uses semantic HTML (`<table>`, `<th scope>`). Tooltips use Radix Tooltip (keyboard accessible). Color-coded statuses include text labels. |
| V. Test at Boundaries | PASS | Test plan targets: tRPC procedures (mock external APIs), review status computation (pure functions), UI data states (mock tRPC). |

## Project Structure

### Documentation (this feature)

```text
specs/001-dashboard-mvp/
├── plan.md              # This file
├── research.md          # Phase 0 output — technology decisions
├── data-model.md        # Phase 1 output — entity definitions
├── quickstart.md        # Phase 1 output — dev setup guide
├── contracts/           # Phase 1 output — tRPC router contracts
│   └── trpc-router.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/
├── server/
│   ├── src/
│   │   ├── index.ts                 # Express server entry point
│   │   ├── router.ts                # Root tRPC router (merges sub-routers)
│   │   ├── trpc.ts                  # tRPC instance + context creation
│   │   ├── routers/
│   │   │   ├── github.ts            # GitHub data procedures
│   │   │   ├── jira.ts              # Jira data procedures
│   │   │   └── config.ts            # Configuration CRUD procedures
│   │   ├── services/
│   │   │   ├── github/
│   │   │   │   ├── client.ts        # GitHub GraphQL client
│   │   │   │   ├── queries.ts       # GraphQL query strings
│   │   │   │   └── transforms.ts    # Response → typed entities
│   │   │   └── jira/
│   │   │       ├── client.ts        # Jira REST client
│   │   │       ├── queries.ts       # JQL query builders
│   │   │       ├── transforms.ts    # Response → typed entities
│   │   │       └── field-map.ts     # Semantic name → custom field ID
│   │   ├── logic/
│   │   │   ├── review-status.ts     # Author/Reviewer status computation
│   │   │   ├── recommended-actions.ts # Action derivation from status
│   │   │   └── grouping.ts          # PR grouping logic (4 default groups)
│   │   └── types/
│   │       ├── pr.ts                # PullRequest, Review, CheckStatus
│   │       ├── jira.ts              # JiraIssue, Sprint, Epic
│   │       ├── config.ts            # DashboardConfig, TeamMember
│   │       └── activity.ts          # ActivityEvent
│   └── package.json
│
├── client/
│   ├── src/
│   │   ├── main.tsx                 # App entry point
│   │   ├── App.tsx                  # Router + tRPC provider setup
│   │   ├── trpc.ts                  # tRPC client + React Query setup
│   │   ├── routes/
│   │   │   ├── pr-reviews.tsx       # PR Reviews view (default)
│   │   │   ├── activity-timeline.tsx # Activity Timeline view
│   │   │   ├── sprint-status.tsx    # Sprint Status view
│   │   │   └── epic-status.tsx      # Epic Status view
│   │   ├── components/
│   │   │   ├── pr-table/
│   │   │   │   ├── PRTable.tsx      # Main table (TanStack Table)
│   │   │   │   ├── columns.tsx      # Column definitions
│   │   │   │   ├── ReviewStatusCell.tsx  # Status cell with tooltip
│   │   │   │   └── GroupHeader.tsx   # Group section headers
│   │   │   ├── actions-panel/
│   │   │   │   └── ActionsPanel.tsx  # Recommended Actions collapsible
│   │   │   ├── controls/
│   │   │   │   ├── PerspectiveSelector.tsx
│   │   │   │   ├── GroupBySelector.tsx
│   │   │   │   ├── FilterBar.tsx
│   │   │   │   ├── ColumnCustomizer.tsx
│   │   │   │   └── RefreshControls.tsx
│   │   │   └── shared/
│   │   │       ├── LoadingIndicator.tsx
│   │   │       ├── ErrorBanner.tsx
│   │   │       └── StatusBadge.tsx
│   │   ├── hooks/
│   │   │   ├── useViewState.ts      # URL search params ↔ view state
│   │   │   ├── useProgressiveData.ts # Orchestrates 3-phase loading
│   │   │   └── useAutoRefresh.ts    # Polling toggle logic
│   │   └── lib/
│   │       └── url-state.ts         # URL param serialization helpers
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
package.json                         # Workspace root (pnpm workspaces)
pnpm-workspace.yaml
tsconfig.base.json                   # Shared TypeScript config
.env.example                         # Template for required env vars
.gitignore
```

**Structure Decision**: Web application with two npm workspace packages. The server exports its tRPC router type for the client to consume, providing end-to-end type safety without a shared types package (tRPC handles this via TypeScript inference). The server serves the built client assets in production.

## Complexity Tracking

No constitution violations to justify. All design decisions align with the five core principles.
