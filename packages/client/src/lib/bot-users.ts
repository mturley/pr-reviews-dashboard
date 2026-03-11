const BOT_USERNAMES = new Set(["dependabot[bot]", "dependabot", "coderabbitai[bot]", "coderabbitai"]);

export function isBot(username: string): boolean {
  return BOT_USERNAMES.has(username.toLowerCase());
}

export function formatUsername(username: string): string {
  return isBot(username) ? `🤖 ${username}` : username;
}
