// Google API client with OAuth token management

import { cached } from "../cache.js";
import type { GoogleCredentials } from "../../types/google.js";

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

// Get a fresh access token using the refresh token, cached for ~50 minutes
export async function getAccessToken(credentials: GoogleCredentials): Promise<string> {
  const cacheKey = `googleToken:${credentials.label}`;
  return cached(cacheKey, 50 * 60 * 1000, async () => {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        refresh_token: credentials.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`[google] Token refresh failed for "${credentials.label}": ${response.status} ${body.slice(0, 300)}`);
      throw new Error(`Google token refresh failed for "${credentials.label}": ${response.status}`);
    }

    const data = (await response.json()) as TokenResponse;
    return data.access_token;
  });
}

// Generic authenticated Google API GET request
export async function googleRequest<T>(
  credentials: GoogleCredentials,
  url: string,
  params?: Record<string, string>,
): Promise<T> {
  const accessToken = await getAccessToken(credentials);

  const reqUrl = new URL(url);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      reqUrl.searchParams.set(key, value);
    }
  }

  const response = await fetch(reqUrl.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[google] API error ${response.status} on ${reqUrl.pathname}: ${body.slice(0, 300)}`);
    throw new Error(`Google API error: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}
