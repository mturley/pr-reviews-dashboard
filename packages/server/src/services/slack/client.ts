// Slack Web API client with request throttling

export interface SlackRateLimit {
  remaining: number | null;
  resetAt: string | null;
}

let lastRateLimit: SlackRateLimit = { remaining: null, resetAt: null };

export function getLastSlackRateLimit(): SlackRateLimit {
  return lastRateLimit;
}

// Simple throttle: minimum interval between requests (Slack Tier 2 = ~20/min)
const MIN_REQUEST_INTERVAL_MS = 3000;
let lastRequestTime = 0;

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function slackSearch(token: string, query: string): Promise<any> {
  if (!token) {
    return { messages: { matches: [], total: 0 } };
  }

  await throttle();

  const url = new URL("https://slack.com/api/search.messages");
  url.searchParams.set("query", query);
  url.searchParams.set("sort", "timestamp");
  url.searchParams.set("sort_dir", "desc");
  url.searchParams.set("count", "20");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  // Track rate limit headers
  const remaining = response.headers.get("x-ratelimit-remaining");
  const reset = response.headers.get("x-ratelimit-reset");
  if (remaining !== null) {
    lastRateLimit = {
      remaining: parseInt(remaining, 10),
      resetAt: reset ? new Date(parseInt(reset, 10) * 1000).toISOString() : null,
    };
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get("retry-after");
    lastRateLimit = {
      remaining: 0,
      resetAt: retryAfter
        ? new Date(Date.now() + parseInt(retryAfter, 10) * 1000).toISOString()
        : null,
    };
    console.warn("[slack] Rate limited, skipping search");
    return { messages: { matches: [], total: 0 } };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[slack] API error ${response.status}: ${body.slice(0, 500)}`);
    return { messages: { matches: [], total: 0 } };
  }

  const data = await response.json();
  if (!data.ok) {
    console.error(`[slack] API response not ok: ${data.error ?? "unknown"}`);
    return { messages: { matches: [], total: 0 } };
  }

  return data;
}
