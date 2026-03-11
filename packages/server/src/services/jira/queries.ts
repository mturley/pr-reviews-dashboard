// T036: JQL query builders

export function buildSprintDiscoveryJQL(projectKey: string, componentName: string): string {
  let jql = `project = "${projectKey}" AND sprint in openSprints()`;
  if (componentName) {
    jql += ` AND component = "${componentName}"`;
  }
  jql += " ORDER BY updated DESC";
  return jql;
}

export function buildSprintIssuesJQL(projectKey: string, componentName: string, sprintId?: number): string {
  let jql = `project = "${projectKey}"`;
  if (sprintId) {
    jql += ` AND sprint = ${sprintId}`;
  } else {
    jql += ` AND sprint in openSprints()`;
  }
  if (componentName) {
    jql += ` AND component = "${componentName}"`;
  }
  jql += " ORDER BY priority ASC, updated DESC";
  return jql;
}

export function buildEpicIssuesJQL(
  epicKey: string,
  includeClosedResolved: boolean,
): string {
  let jql = `"Epic Link" = "${epicKey}"`;
  if (!includeClosedResolved) {
    jql += ` AND status NOT IN ("Closed", "Resolved")`;
  }
  jql += " ORDER BY priority ASC, status ASC";
  return jql;
}
