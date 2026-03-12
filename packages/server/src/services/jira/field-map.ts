// T034: Jira field mapping (semantic name to custom field ID lookup from config)

import type { JiraFieldMapping } from "../../types/config.js";

export type SemanticFieldName = keyof JiraFieldMapping;

export function getFieldId(mapping: JiraFieldMapping, name: SemanticFieldName): string {
  return mapping[name];
}

export function getRequiredFields(mapping: JiraFieldMapping): string[] {
  return [
    "summary",
    "description",
    "issuetype",
    "priority",
    "status",
    "assignee",
    "reporter",
    "labels",
    "created",
    "updated",
    mapping.gitPullRequest,
    mapping.sprint,
    mapping.storyPoints,
    mapping.originalStoryPoints,
    mapping.epicLink,
    mapping.blocked,
    mapping.blockedReason,
    mapping.activityType,
  ];
}
