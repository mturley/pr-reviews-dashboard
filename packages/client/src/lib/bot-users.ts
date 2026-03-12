const BOT_USERNAMES = new Set([
  "dependabot[bot]", "dependabot",
  "coderabbitai[bot]", "coderabbitai",
  "openshift-ci[bot]", "openshift-ci",
  "openshift-merge[bot]", "openshift-merge-robot", "openshift-merge-bot",
  "codecov[bot]", "codecov",
  "google-oss-prow",
]);

export function isBot(username: string): boolean {
  return BOT_USERNAMES.has(username.toLowerCase());
}

export function formatUsername(username: string): string {
  return isBot(username) ? `🤖 ${username}` : username;
}
