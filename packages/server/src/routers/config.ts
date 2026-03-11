// T016: config.get and config.update tRPC procedures

import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { loadConfig, saveConfig, getConfigFilePath } from "../services/config.js";

export const configRouter = router({
  get: publicProcedure.query(async ({ ctx }) => {
    const config = await loadConfig();
    return {
      config,
      configFilePath: getConfigFilePath(),
      jiraHost: ctx.jiraHost ?? null,
    };
  }),

  update: publicProcedure
    .input(
      z.object({
        config: z.record(z.unknown()),
      }),
    )
    .mutation(async ({ input }) => {
      const current = await loadConfig();
      const updated = { ...current, ...input.config };
      const saved = await saveConfig(updated);
      return { config: saved };
    }),
});
