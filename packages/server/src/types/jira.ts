// T010: Jira types per data-model.md

import type { JiraPriority, PullRequestRef } from "./pr.js";

export type { JiraPriority };

export interface JiraIssue {
  key: string;
  url: string;
  type: string;
  typeIconUrl: string;
  summary: string;
  priority: JiraPriority;
  state: string;
  assignee: string | null;
  assigneeAccountId: string | null;
  sprintName: string | null;
  sprintId: number | null;
  epicKey: string | null;
  epicSummary: string | null;
  storyPoints: number | null;
  originalStoryPoints: number | null;
  blocked: boolean;
  blockedReason: string | null;
  labels: string[];
  activityType: string | null;
  reporter: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  description: string | null;
  linkedPRUrls: string[];
  linkedPRs: PullRequestRef[];
}
