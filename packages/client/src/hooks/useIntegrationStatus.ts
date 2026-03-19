import { trpc } from "@/trpc";

export function useIntegrationStatus() {
  const query = trpc.config.getIntegrationStatus.useQuery();
  return {
    slackEnabled: query.data?.slack.enabled ?? false,
    googleEnabled: query.data?.google.enabled ?? false,
    isLoading: query.isLoading,
  };
}
