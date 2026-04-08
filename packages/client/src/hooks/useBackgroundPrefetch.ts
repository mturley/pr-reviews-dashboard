// Background prefetching for inactive tabs — runs after the active page settles

import { useEffect, useRef, useCallback } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { useLocation } from "react-router";
import { trpc } from "../trpc";
import { useAutoRefreshContext } from "./useAutoRefreshContext";

export function useBackgroundPrefetch() {
  const location = useLocation();
  const fetchingCount = useIsFetching();
  const { autoRefresh, intervalMs, manualRefreshRef } = useAutoRefreshContext();
  const utils = trpc.useUtils();
  const prevFetchingRef = useRef(fetchingCount);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const prefetchOtherTabs = useCallback((force: boolean) => {
    const currentPath = location.pathname;
    const opts = force ? { staleTime: 0 } : undefined;

    const run = async () => {
      const config = await utils.config.get.fetch();

      // getTeamPRs and getSprintIssues are shared across Overview, Reviews, Sprint, Epic
      if (currentPath !== "/" && currentPath !== "/reviews") {
        utils.github.getTeamPRs.prefetch(undefined, opts);
      }
      if (currentPath !== "/" && currentPath !== "/reviews" && currentPath !== "/sprint") {
        utils.jira.getSprintIssues.prefetch(undefined, opts);
      }

      // Activity queries need config values
      if (currentPath !== "/activity") {
        if (config.config.githubIdentity) {
          utils.github.getActivity.prefetch(
            { username: config.config.githubIdentity, days: 7 },
            opts,
          );
        }
        if (config.config.jiraAccountId) {
          utils.jira.getActivity.prefetch(
            { accountId: config.config.jiraAccountId, days: 7 },
            opts,
          );
        }
      }
    };

    run();
  }, [location.pathname, utils]);

  // Trigger prefetch when fetchingCount transitions from >0 to 0 (page settled)
  // Use a short debounce to avoid false triggers from brief gaps between queries
  useEffect(() => {
    const wasFetching = prevFetchingRef.current > 0;
    const nowSettled = fetchingCount === 0;
    prevFetchingRef.current = fetchingCount;

    if (wasFetching && nowSettled) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        // Only force-refetch if this settle was triggered by a manual refresh
        const force = manualRefreshRef.current;
        manualRefreshRef.current = false;
        prefetchOtherTabs(force);
      }, 300);
    }

    return () => clearTimeout(debounceTimerRef.current);
  }, [fetchingCount, prefetchOtherTabs, manualRefreshRef]);

  // Re-prefetch on the auto-refresh interval (force, since user opted into refresh)
  useEffect(() => {
    if (!autoRefresh) return;

    const id = setInterval(() => {
      prefetchOtherTabs(true);
    }, intervalMs);

    return () => clearInterval(id);
  }, [autoRefresh, intervalMs, prefetchOtherTabs]);
}
