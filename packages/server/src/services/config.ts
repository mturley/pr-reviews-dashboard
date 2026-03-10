// Config file service — reads/writes config.local.json

import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { DashboardConfig } from "../types/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_CONFIG: DashboardConfig = {
  githubIdentity: "",
  jiraIdentity: "",
  teamName: "My Team",
  githubOrgs: [],
  jiraProjectKey: "",
  jiraComponentName: "",
  sprintDiscoveryLabel: "",
  teamMembers: [],
  jiraFieldMapping: {
    gitPullRequest: "customfield_12310220",
    sprint: "customfield_12310940",
    storyPoints: "customfield_12310243",
    originalStoryPoints: "customfield_12314040",
    epicLink: "customfield_12311140",
    blocked: "customfield_12316543",
    blockedReason: "customfield_12316544",
  },
  autoRefreshIntervalMs: 300_000,
  staleThresholdDays: 14,
};

// Resolve relative to repo root (src/services/ -> packages/server/ -> packages/ -> repo root)
function getConfigPath(): string {
  return process.env.CONFIG_PATH ?? path.resolve(__dirname, "../../../..", "config.local.json");
}

// A self-documenting initial config written on first run
const INITIAL_CONFIG_CONTENT = `{
  "githubIdentity": "your-github-username",
  "jiraIdentity": "your-jira-username",
  "teamName": "My Team",
  "githubOrgs": ["your-org"],
  "jiraProjectKey": "MYPROJECT",
  "jiraComponentName": "",
  "sprintDiscoveryLabel": "",
  "autoRefreshIntervalMs": 300000,
  "staleThresholdDays": 14,
  "teamMembers": [
    {
      "displayName": "Your Name",
      "githubUsername": "your-github-username",
      "jiraUsername": "your-jira-username",
      "email": "you@example.com"
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
`;

export async function loadConfig(): Promise<DashboardConfig> {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    await writeFile(configPath, INITIAL_CONFIG_CONTENT, "utf-8");
    return { ...DEFAULT_CONFIG };
  }
  const raw = await readFile(configPath, "utf-8");
  return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
}

export async function saveConfig(config: DashboardConfig): Promise<DashboardConfig> {
  const configPath = getConfigPath();
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
  return config;
}

export function getConfigFilePath(): string {
  return getConfigPath();
}
