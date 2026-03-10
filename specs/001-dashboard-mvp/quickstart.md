# Quickstart: PR Reviews Dashboard MVP

**Branch**: `001-dashboard-mvp` | **Date**: 2026-03-10

## Prerequisites

- Node.js 20.x or later (specify in `.nvmrc`)
- pnpm 9.x (`npm install -g pnpm`)
- GitHub Personal Access Token with `repo` and `read:org` scopes
- Jira Personal Access Token with read access to the target project

## Initial Setup

```bash
# Clone and checkout feature branch
git clone <repo-url>
cd pr-reviews-dashboard
git checkout 001-dashboard-mvp

# Install dependencies
pnpm install

# Copy environment template and fill in secrets
cp .env.example .env
```

## Environment Variables

Create a `.env` file at the repository root:

```bash
# Required: GitHub
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# Required: Jira
JIRA_TOKEN=your-jira-personal-access-token
JIRA_HOST=issues.redhat.com

# Optional: Override default config file path
# CONFIG_PATH=./config.local.json
```

## Configuration File

On first run, the server creates a `config.local.json` file (gitignored) with default values. Edit it to match your team:

```json
{
  "githubIdentity": "your-github-username",
  "jiraIdentity": "your-jira-username",
  "teamName": "Green Scrum",
  "githubOrgs": ["opendatahub-io", "kubeflow"],
  "jiraProjectKey": "RHOAIENG",
  "jiraComponentName": "AI Core Dashboard",
  "sprintDiscoveryLabel": "dashboard-green-scrum",
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

The configuration can also be edited via the dashboard UI (settings page).

## Development

```bash
# Start both server and client in development mode
pnpm dev

# Start server only (runs on port 3000)
pnpm --filter server dev

# Start client only (Vite dev server on port 5173, proxies API to 3000)
pnpm --filter client dev
```

The dashboard opens at `http://localhost:5173` in development (Vite dev server with HMR).

## Testing

```bash
# Run all tests
pnpm test

# Run server tests only
pnpm --filter server test

# Run client tests only
pnpm --filter client test

# Run tests in watch mode
pnpm test -- --watch
```

## Production Build

```bash
# Build both packages
pnpm build

# Start production server (serves API + built client)
pnpm start
```

The production server runs at `http://localhost:3000` and serves both the API and the static frontend.

## Project Scripts (package.json)

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start both server and client in dev mode |
| `pnpm build` | Build both packages for production |
| `pnpm start` | Start production server |
| `pnpm test` | Run all tests |
| `pnpm lint` | Run ESLint across all packages |
| `pnpm typecheck` | Run TypeScript type checking across all packages |

## Troubleshooting

**GitHub rate limit errors**: The dashboard shows remaining rate limit in the UI. If you hit limits, reduce the auto-refresh interval or disable auto-refresh.

**Jira authentication fails**: Verify `JIRA_HOST` is the domain only (e.g. `issues.redhat.com`, not `https://issues.redhat.com`). Verify the PAT has not expired.

**No sprint data**: Ensure `sprintDiscoveryLabel` matches a label on your team's sprint issues, and that `jiraProjectKey` and `jiraComponentName` are correct.

**Custom field IDs wrong**: If using a different Jira instance, discover field IDs via `GET /rest/api/3/field` and update `jiraFieldMapping` in the config file.
