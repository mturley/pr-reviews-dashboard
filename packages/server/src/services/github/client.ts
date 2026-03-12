// T023: GitHub GraphQL client with auth, request, and rate limit tracking

export interface GitHubRateLimit {
  limit: number;
  remaining: number;
  resetAt: string;
}

let lastRateLimit: GitHubRateLimit = { limit: 5000, remaining: 5000, resetAt: "" };

export function getLastRateLimit(): GitHubRateLimit {
  return lastRateLimit;
}

export async function githubGraphQL<T>(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  if (!token) {
    throw new Error("GITHUB_TOKEN is not configured");
  }

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (response.status === 401) {
    throw new Error("GitHub token is invalid or expired");
  }

  if (response.status === 403) {
    const resetAt = response.headers.get("x-ratelimit-reset");
    lastRateLimit = {
      limit: lastRateLimit.limit,
      remaining: 0,
      resetAt: resetAt ? new Date(parseInt(resetAt, 10) * 1000).toISOString() : "",
    };
    throw new Error("GitHub rate limit exceeded");
  }

  const json = (await response.json()) as {
    data?: T & { rateLimit?: { remaining: number; limit?: number; resetAt?: string } };
    errors?: Array<{ message: string }>;
  };

  // Update rate limit from response headers
  const remaining = response.headers.get("x-ratelimit-remaining");
  const limit = response.headers.get("x-ratelimit-limit");
  const resetAt = response.headers.get("x-ratelimit-reset");
  if (remaining !== null) {
    lastRateLimit = {
      limit: limit ? parseInt(limit, 10) : lastRateLimit.limit,
      remaining: parseInt(remaining, 10),
      resetAt: resetAt ? new Date(parseInt(resetAt, 10) * 1000).toISOString() : lastRateLimit.resetAt,
    };
  }

  // Also update from GraphQL response body (more reliable for resetAt)
  const bodyRateLimit = json.data?.rateLimit;
  if (bodyRateLimit) {
    lastRateLimit = {
      limit: bodyRateLimit.limit ?? lastRateLimit.limit,
      remaining: bodyRateLimit.remaining,
      resetAt: bodyRateLimit.resetAt ?? lastRateLimit.resetAt,
    };
  }

  if (json.errors && json.errors.length > 0) {
    throw new Error(`GitHub GraphQL error: ${json.errors[0].message}`);
  }

  if (!json.data) {
    throw new Error("GitHub GraphQL returned no data");
  }

  return json.data;
}
