// Config file service — reads/writes config.local.json

import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import type { DashboardConfig } from "../types/config.js";

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

function getConfigPath(): string {
  return process.env.CONFIG_PATH ?? path.resolve(process.cwd(), "config.local.json");
}

export async function loadConfig(): Promise<DashboardConfig> {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    await writeFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf-8");
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
