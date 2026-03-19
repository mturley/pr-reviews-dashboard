// Transform Slack search API responses into SlackThread objects

import type { SlackThread } from "../../types/slack.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractSlackThreads(searchResponse: any, matchedUrl: string): SlackThread[] {
  const matches = searchResponse?.messages?.matches;
  if (!Array.isArray(matches)) return [];

  // Deduplicate by channel + thread root (use thread_ts or ts)
  const seen = new Set<string>();
  const results: SlackThread[] = [];

  for (const match of matches as Record<string, unknown>[]) {
    const channelObj = match.channel as Record<string, unknown> | undefined;
    const channelId = (channelObj?.id as string) ?? "";
    const threadTs = (match.thread_ts as string) ?? (match.ts as string) ?? "";
    const threadKey = `${channelId}:${threadTs}`;
    if (seen.has(threadKey)) continue;
    seen.add(threadKey);

    results.push({
      channelName: (channelObj?.name as string) ?? "unknown",
      channelId,
      permalink: (match.permalink as string) ?? "",
      snippet: truncateSnippet(stripSlackMarkup((match.text as string) ?? "")),
      author: (match.username as string) ?? (match.user as string) ?? "unknown",
      replyCount: typeof match.reply_count === "number" ? match.reply_count : 0,
      latestReplyTs: (match.latest_reply as string | undefined) ?? null,
      matchedUrl,
      messageTs: (match.ts as string) ?? "",
    });
  }

  return results;
}

function stripSlackMarkup(text: string): string {
  return text
    .replace(/<[^|>]+\|([^>]+)>/g, "$1") // <url|label> -> label
    .replace(/<([^>]+)>/g, "$1") // <url> -> url
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function truncateSnippet(text: string, maxLength = 150): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "...";
}
