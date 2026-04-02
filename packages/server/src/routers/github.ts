// T026: GitHub tRPC router

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc.js";
import { githubGraphQL, getLastRateLimit } from "../services/github/client.js";
import { buildTeamPRsQuery, buildPRsByUrlsQuery } from "../services/github/queries.js";
import { extractPRsFromTeamQuery, extractPRsFromUrlsQuery } from "../services/github/transforms.js";
import { cached } from "../services/cache.js";

export const githubRouter = router({
  getTeamPRs: publicProcedure.query(async ({ ctx }) => {
    const { config, githubToken } = ctx;

    if (!githubToken) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "GitHub token is not configured" });
    }

    const members = config.teamMembers.map((m) => m.githubUsername);
    if (members.length === 0) {
      const rl = getLastRateLimit();
      return {
        prs: [],
        rateLimitRemaining: rl.remaining,
        rateLimitLimit: rl.limit,
        rateLimitResetAt: rl.resetAt,
        fetchedAt: new Date().toISOString(),
      };
    }

    try {
      const cacheKey = `teamPRs:${members.join(",")}:${config.githubOrgs.join(",")}`;
      return await cached(cacheKey, 60_000, async () => {
        console.log(`[progress] github.getTeamPRs: fetching PRs for ${members.length} members across ${config.githubOrgs.length} orgs`);
        const query = buildTeamPRsQuery(members, config.githubOrgs);
        const data = await githubGraphQL<Record<string, unknown>>(githubToken, query);
        const result = extractPRsFromTeamQuery(data);
        const headerRateLimit = getLastRateLimit();
        const rateLimit = result.rateLimit ?? headerRateLimit;
        console.log(`[progress] github.getTeamPRs: done, found ${result.prs.length} PRs (rate limit: ${rateLimit.remaining} remaining)`);

        return {
          prs: result.prs,
          rateLimitRemaining: rateLimit.remaining,
          rateLimitLimit: headerRateLimit.limit,
          rateLimitResetAt: rateLimit.resetAt,
          fetchedAt: new Date().toISOString(),
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const rateLimit = getLastRateLimit();
      if (message.includes("rate limit")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message,
          cause: { originalError: error, rateLimit },
        });
      }
      if (message.includes("invalid") || message.includes("expired")) {
        throw new TRPCError({ code: "UNAUTHORIZED", message, cause: { originalError: error, rateLimit } });
      }
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message, cause: { originalError: error, rateLimit } });
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
        console.log(`[progress] github.getPRsByUrls: fetching ${validPRs.length} linked PRs`);
        const query = buildPRsByUrlsQuery(validPRs);
        const data = await githubGraphQL<Record<string, unknown>>(githubToken, query);
        const result = extractPRsFromUrlsQuery(data);
        console.log(`[progress] github.getPRsByUrls: done, found ${result.prs.length} PRs (${result.notFound.length} not found)`);

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

  // Fetch PR changed files with diffs
  getPRFiles: publicProcedure
    .input(z.object({
      owner: z.string(),
      repo: z.string(),
      pullNumber: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const { githubToken } = ctx;
      if (!githubToken) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "GitHub token is not configured" });
      }

      const { owner, repo, pullNumber } = input;
      console.log(`[progress] github.getPRFiles: fetching files for ${owner}/${repo}#${pullNumber}`);

      const response = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pullNumber}/files?per_page=100`,
        {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github+json",
          },
        },
      );

      if (!response.ok) {
        const msg = await response.text().catch(() => "Unknown error");
        throw new TRPCError({
          code: response.status === 404 ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR",
          message: `GitHub API error ${response.status}: ${msg}`,
        });
      }

      const files = (await response.json()) as Array<{
        filename: string;
        status: string;
        additions: number;
        deletions: number;
        changes: number;
        patch?: string;
        previous_filename?: string;
      }>;

      console.log(`[progress] github.getPRFiles: done, ${files.length} files`);

      return {
        files: files.map((f) => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          patch: f.patch ?? null,
          previousFilename: f.previous_filename ?? null,
        })),
        fetchedAt: new Date().toISOString(),
      };
    }),

  // Fetch PR description and comments for detail modal (lazy loaded)
  getPRExtras: publicProcedure
    .input(z.object({
      owner: z.string(),
      repo: z.string(),
      pullNumber: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const { githubToken } = ctx;
      if (!githubToken) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "GitHub token is not configured" });
      }

      const { owner, repo, pullNumber } = input;
      console.log(`[progress] github.getPRExtras: fetching extras for ${owner}/${repo}#${pullNumber}`);

      const query = `
        query PRExtras($owner: String!, $repo: String!, $number: Int!) {
          repository(owner: $owner, name: $repo) {
            pullRequest(number: $number) {
              body
              comments(first: 100) {
                nodes {
                  id
                  author { login }
                  createdAt
                  updatedAt
                  body
                }
              }
              reviewThreads(first: 100) {
                nodes {
                  id
                  path
                  line
                  isResolved
                  isOutdated
                  comments(first: 50) {
                    nodes {
                      id
                      author { login }
                      createdAt
                      updatedAt
                      body
                    }
                  }
                }
              }
            }
          }
        }
      `;

      type PRExtrasResponse = {
        repository: {
          pullRequest: {
            body: string | null;
            comments: {
              nodes: Array<{
                id: string;
                author: { login: string } | null;
                createdAt: string;
                updatedAt: string;
                body: string;
              }>;
            };
            reviewThreads: {
              nodes: Array<{
                id: string;
                path: string;
                line: number | null;
                isResolved: boolean;
                isOutdated: boolean;
                comments: {
                  nodes: Array<{
                    id: string;
                    author: { login: string } | null;
                    createdAt: string;
                    updatedAt: string;
                    body: string;
                  }>;
                };
              }>;
            };
          } | null;
        } | null;
      };

      const data = await githubGraphQL<PRExtrasResponse>(
        githubToken,
        query,
        { owner, repo, number: pullNumber },
      );

      const pr = data.repository?.pullRequest;
      if (!pr) {
        throw new TRPCError({ code: "NOT_FOUND", message: `PR ${owner}/${repo}#${pullNumber} not found` });
      }

      console.log(`[progress] github.getPRExtras: done, ${pr.comments.nodes.length} comments, ${pr.reviewThreads.nodes.length} review threads`);

      return {
        body: pr.body || null,
        comments: pr.comments.nodes.map((c) => ({
          id: c.id,
          author: c.author?.login ?? "ghost",
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          body: c.body,
        })),
        reviewThreads: pr.reviewThreads.nodes.map((thread) => ({
          id: thread.id,
          path: thread.path,
          line: thread.line,
          isResolved: thread.isResolved,
          isOutdated: thread.isOutdated,
          comments: thread.comments.nodes.map((c) => ({
            id: c.id,
            author: c.author?.login ?? "ghost",
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            body: c.body,
          })),
        })),
        fetchedAt: new Date().toISOString(),
      };
    }),

  // T061: GitHub activity events
  getActivity: publicProcedure
    .input(z.object({ username: z.string(), days: z.number().min(1).max(30).default(7) }))
    .query(async ({ ctx, input }) => {
      const { githubToken } = ctx;
      if (!githubToken) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "GitHub token is not configured" });
      }

      console.log(`[progress] github.getActivity: fetching activity for ${input.username} (${input.days} days)`);
      const since = new Date(new Date().setHours(0, 0, 0, 0) - (input.days - 1) * 24 * 60 * 60 * 1000).toISOString();
      const query = `
        query UserActivity($query: String!) {
          search(query: $query, type: ISSUE, first: 100) {
            nodes {
              ... on PullRequest {
                id number title url state isDraft createdAt mergedAt closedAt
                author { login }
                repository { owner { login } name }
                reviews(first: 10) { nodes { author { login } state submittedAt } }
                comments(first: 10) { nodes { author { login } createdAt } }
                commits(last: 10) { nodes { commit { oid pushedDate committedDate author { user { login } } } } }
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

      function derivePRState(pr: Record<string, unknown>): "OPEN" | "MERGED" | "CLOSED" | "DRAFT" {
        if (pr.mergedAt) return "MERGED";
        if (pr.state === "CLOSED") return "CLOSED";
        if (pr.isDraft) return "DRAFT";
        return "OPEN";
      }

      const events: Array<{
        id: string; source: "github"; timestamp: string;
        actor: string; actorDisplayName: string;
        actionType: string; targetType: string;
        targetKey: string; targetTitle: string; detail: string | null;
        prState?: "OPEN" | "MERGED" | "CLOSED" | "DRAFT" | null;
        prAuthor?: string | null;
      }> = [];

      for (const node of data.search.nodes) {
        if (!node.id) continue;
        const pr = node as Record<string, unknown>;
        const author = (pr.author as { login: string })?.login ?? "unknown";
        const repo = pr.repository as { owner: { login: string }; name: string };
        const repoName = `${repo?.owner?.login}/${repo?.name}`;
        const url = pr.url as string;
        const title = pr.title as string;
        const prState = derivePRState(pr);

        if (author === input.username) {
          events.push({
            id: `${pr.id}-opened`, source: "github", timestamp: pr.createdAt as string,
            actor: author, actorDisplayName: author,
            actionType: "pr_opened", targetType: "pr",
            targetKey: url, targetTitle: title, detail: repoName,
            prState, prAuthor: author,
          });
        }
        if (pr.mergedAt) {
          events.push({
            id: `${pr.id}-merged`, source: "github", timestamp: pr.mergedAt as string,
            actor: author, actorDisplayName: author,
            actionType: "pr_merged", targetType: "pr",
            targetKey: url, targetTitle: title, detail: repoName,
            prState: "MERGED", prAuthor: author,
          });
        }

        const reviews = pr.reviews as { nodes: Array<{ author: { login: string } | null; state: string; submittedAt: string | null }> } | undefined;
        if (reviews?.nodes) {
          for (const review of reviews.nodes) {
            const reviewAuthor = review.author?.login;
            if (reviewAuthor === input.username && review.submittedAt) {
              const stateLabel = review.state === "APPROVED" ? "Approved"
                : review.state === "CHANGES_REQUESTED" ? "Changes requested"
                : review.state === "COMMENTED" ? "Commented"
                : review.state === "DISMISSED" ? "Dismissed"
                : review.state;
              events.push({
                id: `${pr.id}-review-${review.submittedAt}`, source: "github", timestamp: review.submittedAt,
                actor: reviewAuthor, actorDisplayName: reviewAuthor,
                actionType: "pr_reviewed", targetType: "review",
                targetKey: url, targetTitle: title, detail: stateLabel,
                prState, prAuthor: author,
              });
            }
          }
        }

        const comments = pr.comments as { nodes: Array<{ author: { login: string } | null; createdAt: string }> } | undefined;
        if (comments?.nodes) {
          for (const comment of comments.nodes) {
            const commentAuthor = comment.author?.login;
            if (commentAuthor === input.username && comment.createdAt) {
              events.push({
                id: `${pr.id}-comment-${comment.createdAt}`, source: "github", timestamp: comment.createdAt,
                actor: commentAuthor, actorDisplayName: commentAuthor,
                actionType: "pr_commented", targetType: "comment",
                targetKey: url, targetTitle: title, detail: repoName,
                prState, prAuthor: author,
              });
            }
          }
        }

        const commits = pr.commits as { nodes: Array<{ commit: { oid: string; pushedDate: string | null; committedDate: string | null; author: { user: { login: string } | null } | null } }> } | undefined;
        if (commits?.nodes) {
          for (const { commit } of commits.nodes) {
            const commitAuthor = commit.author?.user?.login;
            const commitDate = commit.pushedDate ?? commit.committedDate;
            if (commitAuthor === input.username && commitDate) {
              events.push({
                id: `${pr.id}-push-${commit.oid}`, source: "github", timestamp: commitDate,
                actor: commitAuthor, actorDisplayName: commitAuthor,
                actionType: "pr_pushed", targetType: "pr",
                targetKey: url, targetTitle: title, detail: repoName,
                prState, prAuthor: author,
              });
            }
          }
        }
      }

      // Filter events to only include those within the requested time window
      const sinceMs = new Date(since).getTime();
      const filtered = events.filter((e) => new Date(e.timestamp).getTime() >= sinceMs);
      filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      console.log(`[progress] github.getActivity: done, ${filtered.length} events`);

      return { events: filtered, fetchedAt: new Date().toISOString() };
    }),
});
