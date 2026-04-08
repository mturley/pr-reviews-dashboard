// T038: Jira tRPC router

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc.js";
import { jiraSearch, jiraRequest, type JiraRawIssue } from "../services/jira/client.js";
import { buildSprintDiscoveryJQL, buildSprintIssuesJQL, buildEpicIssuesJQL, buildMyIssuesJQL, buildFilterIssuesJQL, buildWatchedIssuesJQL } from "../services/jira/queries.js";
import { getRequiredFields } from "../services/jira/field-map.js";
import { transformJiraIssue } from "../services/jira/transforms.js";
import { adfToMarkdown } from "../services/jira/adf-to-markdown.js";
import { cached } from "../services/cache.js";

export const jiraRouter = router({
  getSprintIssues: publicProcedure.query(async ({ ctx }) => {
    const { config, jiraEmail, jiraToken, jiraHost } = ctx;

    if (!jiraToken || !jiraHost) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Jira token or host is not configured",
      });
    }

    try {
      const cacheKey = `sprintIssues:${config.jiraProjectKey}:${config.jiraComponentName ?? ""}:${config.teamName ?? ""}`;
      return await cached(cacheKey, 60_000, async () => {
        const fields = getRequiredFields(config.jiraFieldMapping);
        const teamName = config.teamName;

        // Step 1: Discover the team's sprint ID from open sprints
        let targetSprintId: number | undefined;
        let sprintName = "Current Sprint";

        if (teamName) {
          console.log(`[progress] jira.getSprintIssues: discovering sprint for team "${teamName}"`);
          const discoveryJql = buildSprintDiscoveryJQL(config.jiraProjectKey, config.jiraComponentName);
          const discoveryResponse = await jiraSearch(jiraHost, jiraEmail, jiraToken, discoveryJql, [config.jiraFieldMapping.sprint], 50);
          for (const raw of discoveryResponse.issues) {
            const issue = transformJiraIssue(raw, jiraHost, config.jiraFieldMapping);
            if (issue.sprintName?.toLowerCase().includes(teamName.toLowerCase())) {
              targetSprintId = issue.sprintId ?? undefined;
              sprintName = issue.sprintName;
              break;
            }
          }
          console.log(`[progress] jira.getSprintIssues: found sprint "${sprintName}" (id: ${targetSprintId ?? "fallback"})`);
        }

        // Step 2: Fetch issues for the specific sprint (or all open sprints as fallback)
        console.log("[progress] jira.getSprintIssues: fetching sprint issues");
        const jql = buildSprintIssuesJQL(config.jiraProjectKey, config.jiraComponentName, targetSprintId);
        const response = await jiraSearch(jiraHost, jiraEmail, jiraToken, jql, fields);

        const issues = response.issues.map((raw) =>
          transformJiraIssue(raw, jiraHost, config.jiraFieldMapping),
        );
        console.log(`[progress] jira.getSprintIssues: found ${issues.length} issues`);

        // Enrich issues with epic summaries
        const epicKeys = [...new Set(issues.map((i) => i.epicKey).filter(Boolean))] as string[];
        if (epicKeys.length > 0) {
          console.log(`[progress] jira.getSprintIssues: enriching ${epicKeys.length} epic summaries`);
          const epicJql = epicKeys.map((k) => `key = "${k}"`).join(" OR ");
          try {
            const epicResponse = await jiraSearch(jiraHost, jiraEmail, jiraToken, epicJql, ["summary", "issuetype", "status"], epicKeys.length);
            const epicMap = new Map<string, { summary: string; status: string }>();
            for (const raw of epicResponse.issues) {
              epicMap.set(raw.key, {
                summary: raw.fields?.summary ?? "",
                status: raw.fields?.status?.name ?? "",
              });
            }
            for (const issue of issues) {
              if (issue.epicKey) {
                const epic = epicMap.get(issue.epicKey);
                issue.epicSummary = epic?.summary ?? null;
                issue.epicStatus = epic?.status ?? null;
              }
            }
          } catch {
            // Non-critical — proceed without epic summaries
          }
        }
        console.log("[progress] jira.getSprintIssues: done");

        const sprintId = targetSprintId ?? issues.find((i) => i.sprintId)?.sprintId ?? 0;
        const sprintUrl = sprintId
          ? config.jiraRapidViewId
            ? `https://${jiraHost}/jira/software/projects/${config.jiraProjectKey}/boards/${config.jiraRapidViewId}?sprint=${sprintId}`
            : `https://${jiraHost}/issues/?jql=${encodeURIComponent(`sprint = ${sprintId}`)}`
          : null;

        return {
          issues,
          sprintName,
          sprintId,
          sprintUrl,
          fetchedAt: new Date().toISOString(),
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (message.includes("rate limit")) {
        throw new TRPCError({ code: "FORBIDDEN", message, cause: error });
      }
      if (message.includes("invalid") || message.includes("expired")) {
        throw new TRPCError({ code: "UNAUTHORIZED", message, cause: error });
      }
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message, cause: error });
    }
  }),

  // T066: Epic issues
  getEpicIssues: publicProcedure
    .input(z.object({
      epicKey: z.string(),
      includeClosedResolved: z.boolean().default(true),
    }))
    .query(async ({ ctx, input }) => {
      const { config, jiraEmail, jiraToken, jiraHost } = ctx;
      if (!jiraToken || !jiraHost) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Jira not configured" });
      }

      try {
        console.log(`[progress] jira.getEpicIssues: fetching issues for epic ${input.epicKey}`);
        const jql = buildEpicIssuesJQL(input.epicKey, input.includeClosedResolved);
        const fields = getRequiredFields(config.jiraFieldMapping);
        const response = await jiraSearch(jiraHost, jiraEmail, jiraToken, jql, fields);
        const issues = response.issues.map((raw) =>
          transformJiraIssue(raw, jiraHost, config.jiraFieldMapping),
        );

        // Fetch epic summary
        const epicData = await jiraRequest<{ fields: { summary: string } }>(
          jiraHost, jiraEmail, jiraToken, `/rest/api/3/issue/${input.epicKey}`,
          { fields: "summary" },
        );
        console.log(`[progress] jira.getEpicIssues: done, ${issues.length} issues`);

        return {
          issues,
          epicSummary: epicData.fields.summary,
          fetchedAt: new Date().toISOString(),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message, cause: error });
      }
    }),

  getIssue: publicProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      const { config, jiraEmail, jiraToken, jiraHost } = ctx;
      if (!jiraToken || !jiraHost) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Jira not configured" });
      }

      try {
        const cacheKey = `jiraIssue:${input.key}`;
        return await cached(cacheKey, 60_000, async () => {
          console.log(`[progress] jira.getIssue: fetching ${input.key}`);
          const fields = getRequiredFields(config.jiraFieldMapping);
          const raw = await jiraRequest<JiraRawIssue>(
            jiraHost, jiraEmail, jiraToken,
            `/rest/api/3/issue/${input.key}`,
            { fields: fields.join(",") },
          );
          const issue = transformJiraIssue(raw, jiraHost, config.jiraFieldMapping);

          if (issue.epicKey) {
            try {
              const epicData = await jiraRequest<{ fields: { summary: string } }>(
                jiraHost, jiraEmail, jiraToken,
                `/rest/api/3/issue/${issue.epicKey}`,
                { fields: "summary" },
              );
              issue.epicSummary = epicData.fields.summary;
            } catch { /* non-critical */ }
          }

          console.log(`[progress] jira.getIssue: done`);
          return issue;
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("rate limit")) {
          throw new TRPCError({ code: "FORBIDDEN", message, cause: error });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message, cause: error });
      }
    }),

  getIssueComments: publicProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      const { jiraEmail, jiraToken, jiraHost } = ctx;
      if (!jiraToken || !jiraHost) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Jira not configured" });
      }

      try {
        const cacheKey = `jiraComments:${input.key}`;
        return await cached(cacheKey, 60_000, async () => {
          console.log(`[progress] jira.getIssueComments: fetching for ${input.key}`);
          const data = await jiraRequest<{
            comments: Array<{
              id: string;
              author: { accountId: string; displayName: string };
              body: unknown;
              created: string;
              updated: string;
            }>;
          }>(jiraHost, jiraEmail, jiraToken, `/rest/api/3/issue/${input.key}/comment`);

          const comments = (data.comments ?? []).map((c) => ({
            id: c.id,
            author: c.author?.accountId ?? "unknown",
            authorDisplayName: c.author?.displayName ?? "Unknown",
            body: (typeof c.body === "object" ? adfToMarkdown(c.body) : String(c.body ?? "")) ?? "",
            created: c.created,
            updated: c.updated,
          }));
          console.log(`[progress] jira.getIssueComments: done, ${comments.length} comments`);
          return { comments };
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message, cause: error });
      }
    }),

  // T062: Jira activity events
  getActivity: publicProcedure
    .input(z.object({ accountId: z.string(), days: z.number().min(1).max(30).default(7) }))
    .query(async ({ ctx, input }) => {
      const { config, jiraEmail, jiraToken, jiraHost } = ctx;
      if (!jiraToken || !jiraHost) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Jira not configured" });
      }

      const since = new Date(new Date().setHours(0, 0, 0, 0) - (input.days - 1) * 24 * 60 * 60 * 1000);
      const sinceStr = since.toISOString().split("T")[0];
      const epicLinkField = config.jiraFieldMapping.epicLink;
      const jql = `project = "${config.jiraProjectKey}" AND updated >= "${sinceStr}" AND (assignee = "${input.accountId}" OR reporter = "${input.accountId}")`;

      try {
        console.log(`[progress] jira.getActivity: fetching activity for ${input.accountId} (${input.days} days)`);
        const response = await jiraSearch(jiraHost, jiraEmail, jiraToken, jql, [
          "summary", "status", "issuetype", "updated", "created", "assignee", epicLinkField,
        ]);

        // Collect epic keys for batch lookup
        const epicKeys = new Set<string>();
        for (const issue of response.issues) {
          const ek = issue.fields?.[epicLinkField];
          if (ek) epicKeys.add(ek);
        }

        // Fetch epic summaries
        const epicMap = new Map<string, string>();
        if (epicKeys.size > 0) {
          try {
            const epicJql = [...epicKeys].map((k) => `key = "${k}"`).join(" OR ");
            const epicResponse = await jiraSearch(jiraHost, jiraEmail, jiraToken, epicJql, ["summary"], epicKeys.size);
            for (const raw of epicResponse.issues) {
              epicMap.set(raw.key, raw.fields?.summary ?? "");
            }
          } catch {
            // Non-critical
          }
        }

        const events: Array<{
          id: string; source: "jira"; timestamp: string;
          actor: string; actorDisplayName: string;
          actionType: string; targetType: string;
          targetKey: string; targetTitle: string; detail: string | null;
          jiraTypeIconUrl?: string | null; jiraType?: string | null;
          epicKey?: string | null; epicSummary?: string | null; epicUrl?: string | null;
        }> = [];

        for (const issue of response.issues) {
          const fields = issue.fields ?? {};
          const issueType = fields.issuetype as { name?: string; iconUrl?: string } | undefined;
          const ek = fields[epicLinkField] as string | undefined;
          events.push({
            id: `${issue.key}-updated`,
            source: "jira",
            timestamp: fields.updated ?? fields.created ?? new Date().toISOString(),
            actor: fields.assignee?.accountId ?? input.accountId,
            actorDisplayName: fields.assignee?.displayName ?? input.accountId,
            actionType: "issue_status_changed",
            targetType: "issue",
            targetKey: `https://${jiraHost}/browse/${issue.key}`,
            targetTitle: fields.summary ?? "",
            detail: fields.status?.name ?? null,
            jiraTypeIconUrl: issueType?.iconUrl ?? null,
            jiraType: issueType?.name ?? null,
            epicKey: ek ?? null,
            epicSummary: ek ? (epicMap.get(ek) ?? null) : null,
            epicUrl: ek ? `https://${jiraHost}/browse/${ek}` : null,
          });
        }

        events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        console.log(`[progress] jira.getActivity: done, ${events.length} events`);
        return { events, fetchedAt: new Date().toISOString() };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message, cause: error });
      }
    }),

  // Overview: issues assigned to me in active states
  getMyIssues: publicProcedure.query(async ({ ctx }) => {
    const { config, jiraEmail, jiraToken, jiraHost } = ctx;
    if (!jiraToken || !jiraHost) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Jira not configured" });
    }

    try {
      const cacheKey = `myIssues:${config.jiraAccountId}`;
      return await cached(cacheKey, 60_000, async () => {
        console.log("[progress] jira.getMyIssues: fetching issues assigned to me");
        const jql = buildMyIssuesJQL(config.jiraProjectKey, config.jiraAccountId);
        const fields = getRequiredFields(config.jiraFieldMapping);
        const response = await jiraSearch(jiraHost, jiraEmail, jiraToken, jql, fields);
        const issues = response.issues.map((raw) =>
          transformJiraIssue(raw, jiraHost, config.jiraFieldMapping),
        );

        // Enrich epic summaries
        const epicKeys = [...new Set(issues.map((i) => i.epicKey).filter(Boolean))] as string[];
        if (epicKeys.length > 0) {
          try {
            const epicJql = epicKeys.map((k) => `key = "${k}"`).join(" OR ");
            const epicResponse = await jiraSearch(jiraHost, jiraEmail, jiraToken, epicJql, ["summary", "issuetype", "status"], epicKeys.length);
            const epicMap = new Map<string, { summary: string; status: string }>();
            for (const raw of epicResponse.issues) {
              epicMap.set(raw.key, {
                summary: raw.fields?.summary ?? "",
                status: raw.fields?.status?.name ?? "",
              });
            }
            for (const issue of issues) {
              if (issue.epicKey) {
                const epic = epicMap.get(issue.epicKey);
                issue.epicSummary = epic?.summary ?? null;
                issue.epicStatus = epic?.status ?? null;
              }
            }
          } catch { /* non-critical */ }
        }

        console.log(`[progress] jira.getMyIssues: done, ${issues.length} issues`);
        return { issues, fetchedAt: new Date().toISOString() };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message, cause: error });
    }
  }),

  // Overview: issues matching a saved Jira filter (for team area labels)
  getFilterIssues: publicProcedure
    .input(z.object({ filterId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { config, jiraEmail, jiraToken, jiraHost } = ctx;
      if (!jiraToken || !jiraHost) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Jira not configured" });
      }

      try {
        const cacheKey = `filterIssues:${input.filterId}`;
        return await cached(cacheKey, 60_000, async () => {
          console.log(`[progress] jira.getFilterIssues: fetching filter ${input.filterId}`);
          const jql = buildFilterIssuesJQL(input.filterId);
          const fields = getRequiredFields(config.jiraFieldMapping);
          const response = await jiraSearch(jiraHost, jiraEmail, jiraToken, jql, fields);
          const issues = response.issues.map((raw) =>
            transformJiraIssue(raw, jiraHost, config.jiraFieldMapping),
          );

          // Enrich epic summaries
          const epicKeys = [...new Set(issues.map((i) => i.epicKey).filter(Boolean))] as string[];
          if (epicKeys.length > 0) {
            try {
              const epicJql = epicKeys.map((k) => `key = "${k}"`).join(" OR ");
              const epicResponse = await jiraSearch(jiraHost, jiraEmail, jiraToken, epicJql, ["summary", "issuetype"], epicKeys.length);
              const epicMap = new Map<string, string>();
              for (const raw of epicResponse.issues) {
                epicMap.set(raw.key, raw.fields?.summary ?? "");
              }
              for (const issue of issues) {
                if (issue.epicKey) issue.epicSummary = epicMap.get(issue.epicKey) ?? null;
              }
            } catch { /* non-critical */ }
          }

          console.log(`[progress] jira.getFilterIssues: done, ${issues.length} issues`);
          return { issues, fetchedAt: new Date().toISOString() };
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message, cause: error });
      }
    }),

  // Overview: issues the user is watching
  getWatchedIssues: publicProcedure.query(async ({ ctx }) => {
    const { config, jiraEmail, jiraToken, jiraHost } = ctx;
    if (!jiraToken || !jiraHost) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Jira not configured" });
    }

    try {
      const cacheKey = `watchedIssues:${config.jiraAccountId}`;
      return await cached(cacheKey, 60_000, async () => {
        console.log("[progress] jira.getWatchedIssues: fetching watched issues");
        const jql = buildWatchedIssuesJQL(config.jiraProjectKey, config.jiraAccountId);
        const fields = getRequiredFields(config.jiraFieldMapping);
        const response = await jiraSearch(jiraHost, jiraEmail, jiraToken, jql, fields);
        const issues = response.issues.map((raw) =>
          transformJiraIssue(raw, jiraHost, config.jiraFieldMapping),
        );

        // Enrich epic summaries
        const epicKeys = [...new Set(issues.map((i) => i.epicKey).filter(Boolean))] as string[];
        if (epicKeys.length > 0) {
          try {
            const epicJql = epicKeys.map((k) => `key = "${k}"`).join(" OR ");
            const epicResponse = await jiraSearch(jiraHost, jiraEmail, jiraToken, epicJql, ["summary", "issuetype", "status"], epicKeys.length);
            const epicMap = new Map<string, { summary: string; status: string }>();
            for (const raw of epicResponse.issues) {
              epicMap.set(raw.key, {
                summary: raw.fields?.summary ?? "",
                status: raw.fields?.status?.name ?? "",
              });
            }
            for (const issue of issues) {
              if (issue.epicKey) {
                const epic = epicMap.get(issue.epicKey);
                issue.epicSummary = epic?.summary ?? null;
                issue.epicStatus = epic?.status ?? null;
              }
            }
          } catch { /* non-critical */ }
        }

        console.log(`[progress] jira.getWatchedIssues: done, ${issues.length} issues`);
        return { issues, fetchedAt: new Date().toISOString() };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message, cause: error });
    }
  }),

  // Debug: inspect sprint query results and PR linking
  debugPRLinks: publicProcedure.query(async ({ ctx }) => {
    const { config, jiraEmail, jiraToken, jiraHost } = ctx;
    if (!jiraToken || !jiraHost) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Jira not configured" });
    }

    const teamName = config.teamName;

    // Step 1: Discover sprint
    let targetSprintId: number | undefined;
    let matchedSprintName: string | null = null;
    const allSprintNames: string[] = [];

    if (teamName) {
      const discoveryJql = buildSprintDiscoveryJQL(config.jiraProjectKey, config.jiraComponentName);
      const discoveryResponse = await jiraSearch(jiraHost, jiraEmail, jiraToken, discoveryJql, [config.jiraFieldMapping.sprint], 50);
      for (const raw of discoveryResponse.issues) {
        const issue = transformJiraIssue(raw, jiraHost, config.jiraFieldMapping);
        if (issue.sprintName && !allSprintNames.includes(issue.sprintName)) {
          allSprintNames.push(issue.sprintName);
        }
        if (!targetSprintId && issue.sprintName?.toLowerCase().includes(teamName.toLowerCase())) {
          targetSprintId = issue.sprintId ?? undefined;
          matchedSprintName = issue.sprintName;
        }
      }
    }

    // Step 2: Query the specific sprint
    const jql = buildSprintIssuesJQL(config.jiraProjectKey, config.jiraComponentName, targetSprintId);
    const fields = getRequiredFields(config.jiraFieldMapping);
    const response = await jiraSearch(jiraHost, jiraEmail, jiraToken, jql, fields);

    const issues = response.issues.map((raw) => {
      const transformed = transformJiraIssue(raw, jiraHost, config.jiraFieldMapping);
      return {
        key: raw.key,
        sprintName: transformed.sprintName,
        linkedPRUrls: transformed.linkedPRUrls,
        rawGitPRField: raw.fields?.[config.jiraFieldMapping.gitPullRequest],
      };
    });

    return {
      jql,
      totalFromQuery: response.total,
      maxResults: response.maxResults,
      returnedCount: response.issues.length,
      teamName,
      targetSprintId,
      matchedSprintName,
      issuesWithPRLinks: issues.filter((i) => i.linkedPRUrls.length > 0),
      allSprintNames,
    };
  }),
});
