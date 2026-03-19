#!/usr/bin/env npx tsx
// Google OAuth setup script
// Usage: pnpm setup:google --label "Work"
//
// This script helps you set up Google Calendar API access:
// 1. Opens your browser for Google OAuth consent
// 2. Captures the authorization code via a local HTTP server
// 3. Exchanges the code for a refresh token
// 4. Saves the credentials to config.local.json
//
// Prerequisites:
// - Create a Google Cloud project at https://console.cloud.google.com
// - Enable the Google Calendar API
// - Create OAuth 2.0 credentials (Desktop application type)
// - Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables

import { createServer } from "http";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = process.env.CONFIG_PATH ?? path.resolve(__dirname, "..", "config.local.json");

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

const REDIRECT_PORT = 8095;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

function parseArgs(): { label: string; clientId: string; clientSecret: string } {
  const args = process.argv.slice(2);
  let label = "Work";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--label" && args[i + 1]) {
      label = args[i + 1];
      i++;
    }
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Error: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required.");
    console.error("");
    console.error("To set up Google OAuth:");
    console.error("1. Go to https://console.cloud.google.com/apis/credentials");
    console.error("2. Create OAuth 2.0 Client ID (Desktop application)");
    console.error("3. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file");
    process.exit(1);
  }

  return { label, clientId, clientSecret };
}

async function waitForAuthCode(clientId: string): Promise<string> {
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");

  console.log("\nOpening browser for Google OAuth consent...");
  console.log(`If the browser doesn't open, visit: ${authUrl.toString()}\n`);

  // Open browser
  const { exec } = await import("child_process");
  const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  exec(`${openCmd} "${authUrl.toString()}"`);

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${REDIRECT_PORT}`);
      if (url.pathname === "/callback") {
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`<h1>Authorization failed</h1><p>${error}</p>`);
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (code) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<h1>Authorization successful!</h1><p>You can close this tab and return to the terminal.</p>");
          server.close();
          resolve(code);
          return;
        }
      }

      res.writeHead(404);
      res.end("Not found");
    });

    server.listen(REDIRECT_PORT, () => {
      console.log(`Waiting for authorization callback on port ${REDIRECT_PORT}...`);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error("Authorization timed out after 5 minutes"));
    }, 5 * 60 * 1000);
  });
}

async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${body}`);
  }

  const data = (await response.json()) as { refresh_token?: string; access_token: string };
  if (!data.refresh_token) {
    throw new Error("No refresh token received. Try revoking app access at https://myaccount.google.com/permissions and running again.");
  }

  return data.refresh_token;
}

interface ConfigFile {
  googleAccounts?: Array<{
    label: string;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    calendarIds?: string[];
  }>;
  [key: string]: unknown;
}

async function saveToConfig(label: string, clientId: string, clientSecret: string, refreshToken: string): Promise<void> {
  let config: ConfigFile = {};
  if (existsSync(CONFIG_PATH)) {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    config = JSON.parse(raw);
  }

  const accounts = config.googleAccounts ?? [];
  const existingIndex = accounts.findIndex((a) => a.label === label);

  const account = { label, clientId, clientSecret, refreshToken };
  if (existingIndex >= 0) {
    accounts[existingIndex] = account;
    console.log(`Updated existing Google account "${label}" in config.`);
  } else {
    accounts.push(account);
    console.log(`Added new Google account "${label}" to config.`);
  }

  config.googleAccounts = accounts;
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

async function main() {
  const { label, clientId, clientSecret } = parseArgs();

  console.log(`Setting up Google account: "${label}"`);

  const code = await waitForAuthCode(clientId);
  console.log("Authorization code received. Exchanging for refresh token...");

  const refreshToken = await exchangeCodeForToken(code, clientId, clientSecret);
  console.log("Refresh token obtained.");

  await saveToConfig(label, clientId, clientSecret, refreshToken);
  console.log(`\nGoogle Calendar access configured for "${label}".`);
  console.log("Restart the dashboard server to use the new credentials.");
}

main().catch((err) => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
