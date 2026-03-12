// T011: Configuration types per data-model.md

export interface TeamMember {
  displayName: string;
  githubUsername: string;
  jiraUsername: string;
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

export interface DashboardConfig {
  githubIdentity: string;
  jiraIdentity: string;
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
}
