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
- GitHub Personal Access Token (no scopes needed for public repos; add `repo` scope for private repo access)
- Jira Personal Access Token with read access to your project

## Setup

```bash
pnpm install
cp .env.example .env
```

Edit `.env` with your tokens:

```bash
# Required: GitHub Personal Access Token
# No scopes needed for public repos. Add "repo" scope for private repo access.
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# Required: Jira
JIRA_TOKEN=your-jira-personal-access-token
JIRA_HOST=issues.redhat.com

# Optional: Override default config file path
# CONFIG_PATH=./config.local.json
```

## Configuration

On first run, the server creates a `config.local.json` at the repo root (gitignored). Edit it to match your team:

```json
{
  "githubIdentity": "your-github-username",
  "jiraIdentity": "your-jira-username",
  "teamName": "My Team",
  "githubOrgs": ["my-org", "another-org"],
  "jiraProjectKey": "MYPROJECT",
  "jiraComponentName": "My Component",
  "sprintDiscoveryLabel": "my-team-sprint-label",
  "autoRefreshIntervalMs": 300000,
  "staleThresholdDays": 14,
  "teamMembers": [
    {
      "displayName": "Jane Doe",
      "githubUsername": "janedoe",
      "jiraUsername": "jdoe",
      "email": "jdoe@example.com"
    }
  ],
  "jiraFieldMapping": {
    "gitPullRequest": "customfield_12310220",
    "sprint": "customfield_12310940",
    "storyPoints": "customfield_12310243",
    "originalStoryPoints": "customfield_12314040",
    "epicLink": "customfield_12311140",
    "blocked": "customfield_12316543",
    "blockedReason": "customfield_12316544"
  }
}
```

| Field | Description |
|-------|-------------|
| `githubIdentity` | Your GitHub username (determines "My PRs" vs "PRs I'm Reviewing") |
| `jiraIdentity` | Your Jira username |
| `githubOrgs` | GitHub organizations to search for team PRs |
| `jiraProjectKey` | Jira project key (e.g. `MYPROJECT`) |
| `jiraComponentName` | Jira component to filter sprint issues (leave empty for all) |
| `sprintDiscoveryLabel` | Label used to discover active sprint issues |
| `teamMembers` | Array of team members with GitHub/Jira usernames |
| `jiraFieldMapping` | Maps semantic field names to Jira custom field IDs (see below) |
| `autoRefreshIntervalMs` | Auto-refresh interval in milliseconds (default: 5 minutes) |
| `staleThresholdDays` | PRs older than this are highlighted as stale (default: 14) |

### Jira custom field IDs

The default `jiraFieldMapping` values are for Red Hat's Jira instance. If you use a different Jira instance, discover your field IDs via `GET /rest/api/2/field` and update accordingly.

## Development

```bash
# Start both server and client
pnpm dev

# Start server only (API on port 3000)
pnpm --filter server dev

# Start client only (Vite on port 5173, proxies /trpc to port 3000)
pnpm --filter client dev
```

Open **http://localhost:5173** in development. The Vite dev server handles the client with HMR and proxies API requests to the Express server.

## Production

```bash
pnpm build
pnpm start
```

The production server runs at http://localhost:3000 and serves both the API and the static frontend.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start server and client in dev mode |
| `pnpm build` | Production build |
| `pnpm start` | Run production server |
| `pnpm test` | Run all tests |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript type checking |

## Project Structure

```
packages/
  server/   # tRPC + Express backend (GitHub/Jira API integration)
  client/   # React + Vite frontend (dashboard UI)
```

## Troubleshooting

**GitHub rate limit errors**: The dashboard shows remaining rate limit in the UI. If you hit limits, reduce `autoRefreshIntervalMs` or disable auto-refresh.

**Jira authentication fails**: Verify `JIRA_HOST` is the domain only (e.g. `issues.redhat.com`, not `https://issues.redhat.com`). Verify the PAT has not expired.

**No sprint data**: Ensure `sprintDiscoveryLabel` matches a label on your team's sprint issues, and that `jiraProjectKey` and `jiraComponentName` are correct.

**Custom field IDs wrong**: Discover field IDs via `GET /rest/api/2/field` on your Jira instance and update `jiraFieldMapping` in `config.local.json`.

## Tech Stack

TypeScript, React 19, Vite 6, tRPC 11, TanStack Table, Express 5, Tailwind CSS 4, shadcn/ui, React Router 7
