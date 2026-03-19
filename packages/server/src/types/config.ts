// T011: Configuration types per data-model.md

export interface TeamMember {
  displayName: string;
  githubUsername: string;
  jiraAccountId: string;
  email: string;
}

export interface JiraFieldMapping {
  gitPullRequest: string;
  sprint: string;
  storyPoints: string;
  originalStoryPoints: string;
  epicLink: string;
  blocked: string;
  blockedReason: string;
  activityType: string;
}

export interface IntegrationSettings {
  slack?: { enabled: boolean };
  google?: { enabled: boolean };
}

export interface GoogleAccountConfig {
  label: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  calendarIds?: string[];
}

export interface DashboardConfig {
  githubIdentity: string;
  jiraAccountId: string;
  teamName: string;
  githubOrgs: string[];
  jiraProjectKey: string;
  jiraComponentName: string;
  sprintDiscoveryLabel: string;
  teamMembers: TeamMember[];
  jiraFieldMapping: JiraFieldMapping;
  jiraRapidViewId: number | null;
  autoRefreshIntervalMs: number;
  staleThresholdDays: number;
  integrations?: IntegrationSettings;
  googleAccounts?: GoogleAccountConfig[];
  slackWatchedChannels?: string[];
}
