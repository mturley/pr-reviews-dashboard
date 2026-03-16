// T013: tRPC instance with context creation

import { initTRPC } from "@trpc/server";
import { loadConfig } from "./services/config.js";
import type { DashboardConfig } from "./types/config.js";

export interface TRPCContext {
  config: DashboardConfig;
  githubToken: string;
  jiraEmail: string;
  jiraToken: string;
  jiraHost: string;
}

export async function createContext(): Promise<TRPCContext> {
  const config = await loadConfig();
  return {
    config,
    githubToken: process.env.GITHUB_TOKEN ?? "",
    jiraEmail: process.env.JIRA_EMAIL ?? "",
    jiraToken: process.env.JIRA_TOKEN ?? "",
    jiraHost: process.env.JIRA_HOST ?? "",
  };
}

const t = initTRPC.context<TRPCContext>().create({
  errorFormatter({ shape, error }) {
    const cause = error.cause as Record<string, unknown> | undefined;
    const rateLimit = cause && typeof cause === "object" && "rateLimit" in cause
      ? (cause.rateLimit as { remaining: number; limit: number; resetAt: string })
      : null;
    return { ...shape, data: { ...shape.data, rateLimit } };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
