// T035: Jira REST client (Bearer auth, rate limit tracking, error handling)

export interface JiraRateLimit {
  remaining: number | null;
  resetAt: string | null;
}

let lastRateLimit: JiraRateLimit = { remaining: null, resetAt: null };

export function getLastJiraRateLimit(): JiraRateLimit {
  return lastRateLimit;
}

export async function jiraRequest<T>(
  host: string,
  email: string,
  token: string,
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  if (!token) {
    throw new Error("JIRA_TOKEN is not configured");
  }
  if (!email) {
    throw new Error("JIRA_EMAIL is not configured");
  }
  if (!host) {
    throw new Error("JIRA_HOST is not configured");
  }

  const url = new URL(`https://${host}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const basicAuth = Buffer.from(`${email}:${token}`).toString("base64");
  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/json",
    },
  });

  // Track rate limit headers
  const remaining = response.headers.get("x-ratelimit-remaining");
  const reset = response.headers.get("x-ratelimit-reset");
  if (remaining !== null) {
    lastRateLimit = {
      remaining: parseInt(remaining, 10),
      resetAt: reset,
    };
  }

  if (response.status === 401) {
    throw new Error("Jira token is invalid or expired");
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get("retry-after");
    lastRateLimit = {
      remaining: 0,
      resetAt: retryAfter
        ? new Date(Date.now() + parseInt(retryAfter, 10) * 1000).toISOString()
        : null,
    };
    throw new Error("Jira rate limit exceeded");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[debug] Jira ${response.status} on ${url.pathname}: ${body.slice(0, 500)}`);
    throw new Error(`Jira API error: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export interface JiraSearchResponse {
  issues: JiraRawIssue[];
  total: number;
  maxResults: number;
  startAt: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JiraRawIssue = Record<string, any>;

export async function jiraSearch(
  host: string,
  email: string,
  token: string,
  jql: string,
  fields: string[],
  maxResults = 100,
): Promise<JiraSearchResponse> {
  return jiraRequest<JiraSearchResponse>(host, email, token, "/rest/api/3/search/jql", {
    jql,
    fields: fields.join(","),
    maxResults: String(maxResults),
  });
}
