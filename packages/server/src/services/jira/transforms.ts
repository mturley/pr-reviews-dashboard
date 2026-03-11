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

function parseBlocked(rawValue: unknown): boolean {
  if (!rawValue) return false;
  if (typeof rawValue === "object" && rawValue !== null && "value" in rawValue) {
    return (rawValue as { value: string }).value === "True";
  }
  return false;
}

function parseSprint(rawValue: unknown): { name: string | null; id: number | null } {
  if (!rawValue) return { name: null, id: null };

  // Jira Datacenter returns sprint as a string like:
  // "com.atlassian.greenhopper.service.sprint.Sprint@...[id=12345,name=Sprint 42,...]"
  if (typeof rawValue === "string") {
    const nameMatch = rawValue.match(/name=([^,\]]+)/);
    const idMatch = rawValue.match(/id=(\d+)/);
    return {
      name: nameMatch ? nameMatch[1] : null,
      id: idMatch ? parseInt(idMatch[1], 10) : null,
    };
  }

  // If it's an array (Jira returns array of sprints), take the last one (active)
  if (Array.isArray(rawValue) && rawValue.length > 0) {
    const sprint = rawValue[rawValue.length - 1];
    if (typeof sprint === "string") {
      return parseSprint(sprint);
    }
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
    assigneeUsername: fields.assignee?.name ?? null,
    sprintName: sprint.name,
    sprintId: sprint.id,
    epicKey: fields[fieldMapping.epicLink] ?? null,
    epicSummary: null,
    storyPoints: fields[fieldMapping.storyPoints] ?? null,
    originalStoryPoints: fields[fieldMapping.originalStoryPoints] ?? null,
    blocked: parseBlocked(fields[fieldMapping.blocked]),
    blockedReason: fields[fieldMapping.blockedReason] ?? null,
    linkedPRUrls: parsePRUrls(fields[fieldMapping.gitPullRequest]),
    linkedPRs: [],
  };
}
