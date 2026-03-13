# Setup & Configuration

Detailed setup guide for the PR Reviews Dashboard. For an overview of features, see [README.md](README.md).

## Prerequisites

- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- GitHub Personal Access Token (no scopes needed for public repos; add `repo` scope for private repo access)
- Jira Personal Access Token with read access to your project

## Creating Access Tokens

### GitHub Personal Access Token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens) (Settings > Developer settings > Personal access tokens)
2. Click **Generate new token** and choose **Fine-grained token** (recommended) or **Classic token**
   - **Fine-grained token**: Select the organizations/repos you want to monitor. No additional permissions are needed for public repos. For private repos, grant **Repository access** > **Contents: Read-only**.
   - **Classic token**: No scopes are needed for public repos. Check the `repo` scope for private repo access.
3. Give the token a descriptive name (e.g. `pr-reviews-dashboard`) and set an expiration
4. Copy the generated token — you won't be able to see it again

### Jira Personal Access Token

1. Log in to your Jira instance (e.g. [issues.redhat.com](https://issues.redhat.com))
2. Click your profile avatar in the top-right corner and select **Profile**
3. Click **Personal Access Tokens** in the left sidebar
4. Click **Create token**
5. Give it a name (e.g. `pr-reviews-dashboard`) and click **Create**
6. Copy the generated token — you won't be able to see it again

> **Note:** If your Jira instance uses a different authentication method, consult your Jira admin for instructions on generating a PAT.

## Installation

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

On first run, the server creates a `config.local.json` at the repo root (gitignored). Edit it to match your team. Most of the configuration (everything except `githubIdentity` and `jiraIdentity` at the top) is shared across the team, so reach out to others on the team who are already using this app to get a copy of their `config.local.json` — you'll just need to replace the identity fields with your own usernames.

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
