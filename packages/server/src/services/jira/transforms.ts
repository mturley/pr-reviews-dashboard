// T037: Jira response to typed JiraIssue transforms

import type { JiraIssue } from "../../types/jira.js";
import type { JiraPriority } from "../../types/pr.js";
import type { JiraFieldMapping } from "../../types/config.js";
import type { JiraRawIssue } from "./client.js";

function parsePRUrls(rawValue: unknown): string[] {
  if (!rawValue) return [];
  // Jira returns the Git Pull Request field as an array of URL strings
  if (Array.isArray(rawValue)) {
    return rawValue.filter((v): v is string => typeof v === "string" && v.length > 0);
  }
  // Fallback: comma-separated string
  if (typeof rawValue === "string") {
    return rawValue.split(",").map((url) => url.trim()).filter((url) => url.length > 0);
  }
  return [];
}

function parseActivityType(rawValue: unknown): string | null {
  if (!rawValue) return null;
  if (typeof rawValue === "object" && rawValue !== null && "value" in rawValue) {
    const val = (rawValue as { value: string }).value;
    return val === "None" ? null : val;
  }
  return null;
}

function parseBlocked(rawValue: unknown): boolean {
  if (!rawValue) return false;
  // Jira Cloud returns {id: "10852"} for True, {id: "10853"} for False
  if (typeof rawValue === "object" && rawValue !== null && "id" in rawValue) {
    return String((rawValue as { id: string }).id) === "10852";
  }
  return false;
}

function parseSprint(rawValue: unknown): { name: string | null; id: number | null } {
  if (!rawValue) return { name: null, id: null };

  // Jira Cloud returns an array of sprint objects: [{id, name, state, ...}]
  if (Array.isArray(rawValue) && rawValue.length > 0) {
    const sprint = rawValue[rawValue.length - 1];
    if (typeof sprint === "object" && sprint !== null) {
      return {
        name: sprint.name ?? null,
        id: sprint.id ?? null,
      };
    }
  }

  return { name: null, id: null };
}

export function transformJiraIssue(
  raw: JiraRawIssue,
  jiraHost: string,
  fieldMapping: JiraFieldMapping,
): JiraIssue {
  const fields = raw.fields ?? {};
  const sprint = parseSprint(fields[fieldMapping.sprint]);
  const priority = fields.priority;

  const jiraPriority: JiraPriority = priority
    ? {
        id: String(priority.id ?? ""),
        name: priority.name ?? "Unknown",
        iconUrl: priority.iconUrl ?? "",
      }
    : { id: "", name: "Unknown", iconUrl: "" };

  return {
    key: raw.key,
    url: `https://${jiraHost}/browse/${raw.key}`,
    type: fields.issuetype?.name ?? "Unknown",
    typeIconUrl: fields.issuetype?.iconUrl ?? "",
    summary: fields.summary ?? "",
    priority: jiraPriority,
    state: fields.status?.name ?? "Unknown",
    assignee: fields.assignee?.displayName ?? null,
    assigneeAccountId: fields.assignee?.accountId ?? null,
    sprintName: sprint.name,
    sprintId: sprint.id,
    epicKey: fields[fieldMapping.epicLink] ?? null,
    epicSummary: null,
    storyPoints: fields[fieldMapping.storyPoints] ?? null,
    originalStoryPoints: fields[fieldMapping.originalStoryPoints] ?? null,
    blocked: parseBlocked(fields[fieldMapping.blocked]),
    blockedReason: fields[fieldMapping.blockedReason] ?? null,
    labels: Array.isArray(fields.labels) ? fields.labels : [],
    activityType: parseActivityType(fields[fieldMapping.activityType]),
    reporter: fields.reporter?.displayName ?? null,
    createdAt: fields.created ?? null,
    updatedAt: fields.updated ?? null,
    description: fields.description ?? null,
    linkedPRUrls: parsePRUrls(fields[fieldMapping.gitPullRequest]),
    linkedPRs: [],
  };
}
