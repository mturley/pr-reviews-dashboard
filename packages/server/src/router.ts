// T014: Root tRPC router merging sub-routers

import { router } from "./trpc.js";
import { githubRouter } from "./routers/github.js";
import { jiraRouter } from "./routers/jira.js";
import { configRouter } from "./routers/config.js";

export const appRouter = router({
  github: githubRouter,
  jira: jiraRouter,
  config: configRouter,
});

export type AppRouter = typeof appRouter;
