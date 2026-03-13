# pr-reviews-dashboard Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-10

## Active Technologies

- TypeScript 5.x (strict mode) + React 19.x, Vite 6.x, tRPC 11.x, @tanstack/react-query 5.x, @tanstack/react-table 8.x, Express 5.x, Tailwind CSS 4.x, shadcn/ui, React Router 7.x (001-dashboard-mvp)

## Project Structure

```text
packages/
├── server/     # tRPC + Express backend (GitHub/Jira API integration)
└── client/     # React + Vite frontend (dashboard UI)
```

## Commands

pnpm test && pnpm lint

## Code Style

TypeScript 5.x (strict mode): Follow standard conventions

## Recent Changes

- 001-dashboard-mvp: Added TypeScript 5.x (strict mode) + React 19.x, Vite 6.x, tRPC 11.x, @tanstack/react-query 5.x, @tanstack/react-table 8.x, Express 5.x, Tailwind CSS 4.x, shadcn/ui, React Router 7.x

<!-- MANUAL ADDITIONS START -->

## Architecture Documentation

The file `ARCHITECTURE.md` documents the overall structure, data flow, design decisions, and key abstractions of the application. **When making changes that affect the architecture, update ARCHITECTURE.md to keep it accurate.** This includes changes to:

- Project structure (adding/removing/moving packages, directories, or key files)
- Data flow (loading phases, request flow, caching strategy)
- Business logic design (review status, grouping, recommended actions)
- Server or client architecture (providers, router structure, API integrations)
- Type system (adding/changing shared types)
- Key design decisions or tradeoffs

## "How It Works" Explainer

The file `packages/client/src/components/actions-panel/HowItWorksPanel.tsx` contains a user-facing explanation of how PR inclusion, review status, action needed, and priority ordering work. **When modifying any of the following logic, you must also update HowItWorksPanel.tsx to keep the explanation accurate:**

- PR inclusion/grouping logic (`packages/server/src/logic/grouping.ts`)
- Review status computation (`packages/server/src/logic/review-status.ts`)
- Recommended actions derivation (`packages/server/src/logic/recommended-actions.ts`)
- PR filtering in the route (`packages/client/src/routes/pr-reviews.tsx`)

<!-- MANUAL ADDITIONS END -->
