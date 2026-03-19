// T014: Root tRPC router merging sub-routers

import { router } from "./trpc.js";
import { githubRouter } from "./routers/github.js";
import { jiraRouter } from "./routers/jira.js";
import { configRouter } from "./routers/config.js";
import { slackRouter } from "./routers/slack.js";
import { googleRouter } from "./routers/google.js";

export const appRouter = router({
  github: githubRouter,
  jira: jiraRouter,
  config: configRouter,
  slack: slackRouter,
  google: googleRouter,
});

export type AppRouter = typeof appRouter;
