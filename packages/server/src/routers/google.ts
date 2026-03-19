import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { fetchDayEvents } from "../services/google/calendar.js";
import { cached } from "../services/cache.js";
import type { GoogleCredentials } from "../types/google.js";

export const googleRouter = router({
  getCalendarEvents: publicProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ ctx, input }) => {
      const accounts = (ctx.config.googleAccounts ?? []) as GoogleCredentials[];
      if (accounts.length === 0) {
        return { events: [], fetchedAt: new Date().toISOString() };
      }

      const cacheKey = `calendarEvents:${input.date}:${accounts.map((a) => a.label).join(",")}`;
      return await cached(cacheKey, 120_000, async () => {
        const events = await fetchDayEvents(accounts, input.date);
        return { events, fetchedAt: new Date().toISOString() };
      });
    }),
});
