import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { slackSearch } from "../services/slack/client.js";
import { extractSlackThreads } from "../services/slack/transforms.js";
import { cached } from "../services/cache.js";
import type { SlackThread } from "../types/slack.js";

// Batch URLs into OR queries to reduce request count.
// Slack search supports OR syntax: "url1" OR "url2"
// Keep batches small to avoid query length issues.
const URLS_PER_BATCH = 5;

function batchUrls(urls: string[]): string[][] {
  const batches: string[][] = [];
  for (let i = 0; i < urls.length; i += URLS_PER_BATCH) {
    batches.push(urls.slice(i, i + URLS_PER_BATCH));
  }
  return batches;
}

export const slackRouter = router({
  searchByUrls: publicProcedure
    .input(z.object({ urls: z.array(z.string()) }))
    .query(async ({ ctx, input }) => {
      const { slackToken } = ctx;

      // If no Slack token, return empty results silently
      if (!slackToken) {
        return { threadsByUrl: {} as Record<string, SlackThread[]>, fetchedAt: new Date().toISOString() };
      }

      const cacheKey = `slackSearch:${input.urls.sort().join(",")}`;
      return await cached(cacheKey, 300_000, async () => {
        const threadsByUrl: Record<string, SlackThread[]> = {};
        const batches = batchUrls(input.urls);

        for (const batch of batches) {
          const query = batch.map((url) => `"${url}"`).join(" OR ");
          const response = await slackSearch(slackToken, query);

          // Distribute results back to their matching URLs
          for (const url of batch) {
            const threads = extractSlackThreads(response, url).filter(
              (t) => t.permalink.length > 0,
            );
            // Only include threads where the message actually contains this URL
            const matching = threads.filter((t) => t.snippet.includes(url) || response?.messages?.matches?.some(
              (m: Record<string, unknown>) => {
                const text = (m.text as string) ?? "";
                return text.includes(url) && (
                  t.messageTs === (m.ts as string) || t.messageTs === (m.thread_ts as string)
                );
              },
            ));
            if (matching.length > 0) {
              threadsByUrl[url] = matching;
            }
          }
        }

        return { threadsByUrl, fetchedAt: new Date().toISOString() };
      });
    }),
});
