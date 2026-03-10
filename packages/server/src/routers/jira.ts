// T038: Jira tRPC router

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc.js";
import { jiraSearch, jiraRequest } from "../services/jira/client.js";
import { buildSprintIssuesJQL, buildEpicIssuesJQL } from "../services/jira/queries.js";
import { getRequiredFields } from "../services/jira/field-map.js";
import { transformJiraIssue } from "../services/jira/transforms.js";

export const jiraRouter = router({
  getSprintIssues: publicProcedure.query(async ({ ctx }) => {
    const { config, jiraToken, jiraHost } = ctx;

    if (!jiraToken || !jiraHost) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Jira token or host is not configured",
      });
    }

    try {
      const jql = buildSprintIssuesJQL(config.jiraProjectKey, config.jiraComponentName);
      const fields = getRequiredFields(config.jiraFieldMapping);
      const response = await jiraSearch(jiraHost, jiraToken, jql, fields);

      const issues = response.issues.map((raw) =>
        transformJiraIssue(raw, jiraHost, config.jiraFieldMapping),
      );

      // Extract sprint info from first issue that has it
      const sprintIssue = issues.find((i) => i.sprintName);

      return {
        issues,
        sprintName: sprintIssue?.sprintName ?? "Current Sprint",
        sprintId: sprintIssue?.sprintId ?? 0,
        fetchedAt: new Date().toISOString(),
      };
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
      const { config, jiraToken, jiraHost } = ctx;
      if (!jiraToken || !jiraHost) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Jira not configured" });
      }

      try {
        const jql = buildEpicIssuesJQL(input.epicKey, input.includeClosedResolved);
        const fields = getRequiredFields(config.jiraFieldMapping);
        const response = await jiraSearch(jiraHost, jiraToken, jql, fields);
        const issues = response.issues.map((raw) =>
          transformJiraIssue(raw, jiraHost, config.jiraFieldMapping),
        );

        // Fetch epic summary
        const epicData = await jiraRequest<{ fields: { summary: string } }>(
          jiraHost, jiraToken, `/rest/api/2/issue/${input.epicKey}`,
          { fields: "summary" },
        );

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

  // T062: Jira activity events
  getActivity: publicProcedure
    .input(z.object({ username: z.string(), days: z.number().min(1).max(30).default(7) }))
    .query(async ({ ctx, input }) => {
      const { config, jiraToken, jiraHost } = ctx;
      if (!jiraToken || !jiraHost) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Jira not configured" });
      }

      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const sinceStr = since.toISOString().split("T")[0];
      const jql = `project = "${config.jiraProjectKey}" AND updated >= "${sinceStr}" AND (assignee = "${input.username}" OR reporter = "${input.username}")`;

      try {
        const response = await jiraSearch(jiraHost, jiraToken, jql, [
          "summary", "status", "issuetype", "updated", "created", "assignee",
        ]);

        const events: Array<{
          id: string; source: "jira"; timestamp: string;
          actor: string; actorDisplayName: string;
          actionType: string; targetType: string;
          targetKey: string; targetTitle: string; detail: string | null;
        }> = [];

        for (const issue of response.issues) {
          const fields = issue.fields ?? {};
          events.push({
            id: `${issue.key}-updated`,
            source: "jira",
            timestamp: fields.updated ?? fields.created ?? new Date().toISOString(),
            actor: fields.assignee?.name ?? input.username,
            actorDisplayName: fields.assignee?.displayName ?? input.username,
            actionType: "issue_status_changed",
            targetType: "issue",
            targetKey: issue.key,
            targetTitle: fields.summary ?? "",
            detail: fields.status?.name ?? null,
          });
        }

        events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return { events, fetchedAt: new Date().toISOString() };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message, cause: error });
      }
    }),
});
