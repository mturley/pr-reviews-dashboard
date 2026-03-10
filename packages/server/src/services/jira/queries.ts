// T036: JQL query builders

export function buildSprintIssuesJQL(projectKey: string, componentName: string): string {
  let jql = `project = "${projectKey}" AND sprint in openSprints()`;
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
