# PR Reviews Dashboard

A local-only web dashboard that combines GitHub PR data with Jira issue metadata to give you a unified view of your team's code review workload.

## Features

- **PR Reviews** -- Team PRs grouped by relationship (My PRs, PRs I'm Reviewing, Sprint Review, No Jira) with computed review status, recommended actions, and Jira correlation
- **Activity Timeline** -- Merged GitHub and Jira events in chronological order, grouped by day
- **Sprint Status** -- Jira-primary view of sprint issues grouped by status with linked PR metadata
- **Epic Status** -- All issues in a selected epic with PR linkage

Progressive loading fetches GitHub data first, then Jira, then discovers additional PRs linked from Jira issues. All data stays local -- nothing is stored on external servers.

## Prerequisites

- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- GitHub Personal Access Token with `repo` and `read:org` scopes
- Jira Personal Access Token with read access to your project

## Quick Start

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your GitHub and Jira tokens

# Start development server
pnpm dev
```

Open http://localhost:5173. On first run the server creates a `config.local.json` with defaults -- edit it to configure your team members, GitHub orgs, Jira project, and custom field mappings.

See [specs/001-dashboard-mvp/quickstart.md](specs/001-dashboard-mvp/quickstart.md) for full configuration details and troubleshooting.

## Project Structure

```
packages/
  server/   # tRPC + Express backend (GitHub/Jira API integration)
  client/   # React + Vite frontend (dashboard UI)
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start server and client in dev mode |
| `pnpm build` | Production build |
| `pnpm start` | Run production server (serves API + client on port 3000) |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript type checking |

## Tech Stack

TypeScript, React 19, Vite 6, tRPC 11, TanStack Table, Express 5, Tailwind CSS 4, shadcn/ui, React Router 7
