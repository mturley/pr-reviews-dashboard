import { trpc } from "@/trpc";

/**
 * Returns the configured Jira host (e.g. "issues.redhat.com").
 * Used to construct Jira browse URLs dynamically instead of hardcoding.
 */
export function useJiraHost(): string {
  const configQuery = trpc.config.get.useQuery();
  return configQuery.data?.jiraHost ?? "";
}
