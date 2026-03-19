import { useMemo } from "react";
import { trpc } from "@/trpc";
import { useIntegrationStatus } from "./useIntegrationStatus";
import type { SlackThread } from "../../../server/src/types/slack";

export function useSlackThreads(urls: string[]) {
  const { slackEnabled } = useIntegrationStatus();

  // Deduplicate and sort for stable cache key
  const dedupedUrls = useMemo(() => [...new Set(urls)].sort(), [urls]);

  const query = trpc.slack.searchByUrls.useQuery(
    { urls: dedupedUrls },
    {
      enabled: slackEnabled && dedupedUrls.length > 0,
      staleTime: 5 * 60 * 1000, // 5 minutes — matches server cache TTL
    },
  );

  return {
    threadsByUrl: (query.data?.threadsByUrl ?? {}) as Record<string, SlackThread[]>,
    isLoading: query.isLoading && slackEnabled,
    slackEnabled,
  };
}
