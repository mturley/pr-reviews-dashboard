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

export function buildMyIssuesJQL(projectKey: string, accountId: string): string {
  return `project = "${projectKey}" AND assignee = "${accountId}" AND status IN ("New", "Backlog", "In Progress") ORDER BY priority ASC, updated DESC`;
}

export function buildFilterIssuesJQL(filterId: number): string {
  return `filter = ${filterId} AND status IN ("Review", "Code Review", "In Review", "Testing", "In Testing") ORDER BY priority ASC, updated DESC`;
}

export function buildWatchedIssuesJQL(projectKey: string, accountId: string): string {
  return `project = "${projectKey}" AND watcher = "${accountId}" AND status NOT IN ("Closed", "Resolved", "Done") ORDER BY updated DESC`;
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
