// T026: GitHub tRPC router

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc.js";
import { githubGraphQL, getLastRateLimit } from "../services/github/client.js";
import { buildTeamPRsQuery, buildPRsByUrlsQuery } from "../services/github/queries.js";
import { extractPRsFromTeamQuery, extractPRsFromUrlsQuery } from "../services/github/transforms.js";

export const githubRouter = router({
  getTeamPRs: publicProcedure.query(async ({ ctx }) => {
    const { config, githubToken } = ctx;

    if (!githubToken) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "GitHub token is not configured" });
    }

    const members = config.teamMembers.map((m) => m.githubUsername);
    if (members.length === 0) {
      return {
        prs: [],
        rateLimitRemaining: getLastRateLimit().remaining,
        rateLimitResetAt: getLastRateLimit().resetAt,
        fetchedAt: new Date().toISOString(),
      };
    }

    try {
      const query = buildTeamPRsQuery(members, config.githubOrgs);
      const data = await githubGraphQL<Record<string, unknown>>(githubToken, query);
      const prs = extractPRsFromTeamQuery(data);
      const rateLimit = getLastRateLimit();

      return {
        prs,
        rateLimitRemaining: rateLimit.remaining,
        rateLimitResetAt: rateLimit.resetAt,
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (message.includes("rate limit")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message,
          cause: error,
        });
      }
      if (message.includes("invalid") || message.includes("expired")) {
        throw new TRPCError({ code: "UNAUTHORIZED", message, cause: error });
      }
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message, cause: error });
    }
  }),

  // T041: Fetch PRs by URL (cascade phase)
  getPRsByUrls: publicProcedure
    .input(z.object({ prUrls: z.array(z.string()) }))
    .query(async ({ ctx, input }) => {
      const { githubToken } = ctx;

      if (!githubToken) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "GitHub token is not configured" });
      }

      if (input.prUrls.length === 0) {
        return { prs: [], notFound: [] as string[], fetchedAt: new Date().toISOString() };
      }

      // Parse PR URLs to owner/repo/number
      const parsed = input.prUrls.map((url) => {
        const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
        if (!match) return null;
        return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) };
      });

      const validPRs = parsed.filter((p) => p !== null);
      const invalidUrls = input.prUrls.filter((_, i) => parsed[i] === null);

      if (validPRs.length === 0) {
        return { prs: [], notFound: invalidUrls, fetchedAt: new Date().toISOString() };
      }

      try {
        const query = buildPRsByUrlsQuery(validPRs);
        const data = await githubGraphQL<Record<string, unknown>>(githubToken, query);
        const result = extractPRsFromUrlsQuery(data);

        return {
          prs: result.prs,
          notFound: [...invalidUrls, ...result.notFound],
          fetchedAt: new Date().toISOString(),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message, cause: error });
      }
    }),

  // T061: GitHub activity events
  getActivity: publicProcedure
    .input(z.object({ username: z.string(), days: z.number().min(1).max(30).default(7) }))
    .query(async ({ ctx, input }) => {
      const { githubToken } = ctx;
      if (!githubToken) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "GitHub token is not configured" });
      }

      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000).toISOString();
      const query = `
        query UserActivity($query: String!) {
          search(query: $query, type: ISSUE, first: 100) {
            nodes {
              ... on PullRequest {
                id number title url state createdAt mergedAt closedAt
                author { login }
                repository { owner { login } name }
                reviews(first: 10) { nodes { author { login } state submittedAt } }
                comments(first: 10) { nodes { author { login } createdAt } }
                commits(last: 5) { nodes { commit { pushedDate author { user { login } } } } }
              }
            }
          }
        }
      `;

      type ActivityNode = Record<string, unknown>;
      const data = await githubGraphQL<{ search: { nodes: ActivityNode[] } }>(
        githubToken,
        query,
        { query: `is:pr involves:${input.username} updated:>=${since.split("T")[0]}` },
      );

      const events: Array<{
        id: string; source: "github"; timestamp: string;
        actor: string; actorDisplayName: string;
        actionType: string; targetType: string;
        targetKey: string; targetTitle: string; detail: string | null;
      }> = [];

      for (const node of data.search.nodes) {
        if (!node.id) continue;
        const pr = node as Record<string, unknown>;
        const author = (pr.author as { login: string })?.login ?? "unknown";
        const repo = pr.repository as { owner: { login: string }; name: string };
        const repoName = `${repo?.owner?.login}/${repo?.name}`;
        const url = pr.url as string;
        const title = pr.title as string;

        if (author === input.username) {
          events.push({
            id: `${pr.id}-opened`, source: "github", timestamp: pr.createdAt as string,
            actor: author, actorDisplayName: author,
            actionType: "pr_opened", targetType: "pr",
            targetKey: url, targetTitle: title, detail: repoName,
          });
        }
        if (pr.mergedAt) {
          events.push({
            id: `${pr.id}-merged`, source: "github", timestamp: pr.mergedAt as string,
            actor: author, actorDisplayName: author,
            actionType: "pr_merged", targetType: "pr",
            targetKey: url, targetTitle: title, detail: repoName,
          });
        }
      }

      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return { events, fetchedAt: new Date().toISOString() };
    }),
});
