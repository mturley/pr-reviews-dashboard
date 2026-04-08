// T018: App shell with React Router, tRPC provider, and nav layout

import { useState } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router";
import { QueryClient, QueryClientProvider, keepPreviousData, useIsFetching } from "@tanstack/react-query";
import { trpc, createTRPCClient } from "./trpc";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/controls/ThemeToggle";
import { FontSizeToggle } from "@/components/controls/FontSizeToggle";
import { useTheme } from "@/hooks/useTheme";
import { useFontSize } from "@/hooks/useFontSize";
import { AutoRefreshProvider } from "@/hooks/useAutoRefreshContext";
import { DetailModalProvider } from "@/components/detail-modal/DetailModalProvider";
import Overview from "./routes/overview";
import PRReviews from "./routes/pr-reviews";
import ActivityTimeline from "./routes/activity-timeline";
import SprintStatus from "./routes/sprint-status";
import EpicStatus from "./routes/epic-status";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { useBackgroundPrefetch } from "@/hooks/useBackgroundPrefetch";
import { Loader2 } from "lucide-react";

function useIsTabFetching(queryKeys: string[][]) {
  // Each call to useIsFetching is a stable hook call since queryKeys is static per component
  return queryKeys.reduce(
    (sum, key) =>
      // eslint-disable-next-line react-hooks/rules-of-hooks
      sum + useIsFetching({ queryKey: [key] }),
    0,
  ) > 0;
}

function OverviewNavLink() {
  const isFetching = useIsTabFetching([["github", "getTeamPRs"], ["jira", "getSprintIssues"], ["jira", "getMyIssues"]]);
  return <TabNavLink to="/" label="Overview" isFetching={isFetching} />;
}

function ReviewsNavLink() {
  const isFetching = useIsTabFetching([["github", "getTeamPRs"], ["jira", "getSprintIssues"]]);
  return <TabNavLink to="/reviews" label="My PRs and Reviews" isFetching={isFetching} />;
}

function SprintNavLink() {
  const isFetching = useIsTabFetching([["jira", "getSprintIssues"]]);
  return <TabNavLink to="/sprint" label="Current Sprint Status" isFetching={isFetching} />;
}

function EpicNavLink() {
  const isFetching = useIsTabFetching([["jira", "getEpicIssues"], ["jira", "getSprintIssues"]]);
  return <TabNavLink to="/epic" label="Epic Status" isFetching={isFetching} />;
}

function ActivityNavLink() {
  const isFetching = useIsTabFetching([["github", "getActivity"], ["jira", "getActivity"]]);
  return <TabNavLink to="/activity" label="My Activity" isFetching={isFetching} />;
}

function TabNavLink({ to, label, isFetching }: { to: string; label: string; isFetching: boolean }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `rounded-md px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {label}
          {!isActive && isFetching && (
            <Loader2 className="h-3 w-3 animate-spin text-blue-500 dark:text-blue-400" />
          )}
        </>
      )}
    </NavLink>
  );
}

function NavBar() {
  const { theme, setTheme } = useTheme();
  const { fontSize, setFontSize } = useFontSize();
  return (
    <nav aria-label="Main navigation" className="border-b border-border bg-card px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-lg font-semibold">GitHub + Jira Personal Sprint Dashboard</span>
          <div className="flex gap-1">
            <OverviewNavLink />
            <ReviewsNavLink />
            <SprintNavLink />
            <EpicNavLink />
            <ActivityNavLink />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <FontSizeToggle fontSize={fontSize} onFontSizeChange={setFontSize} />
          <ThemeToggle theme={theme} onThemeChange={setTheme} />
        </div>
      </div>
    </nav>
  );
}

function BackgroundPrefetcher() {
  useBackgroundPrefetch();
  return null;
}

export default function App() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 2 * 60 * 1000, // 2 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes — keep cached data across tab switches
        refetchOnWindowFocus: false,
        placeholderData: keepPreviousData,
      },
    },
  }));
  const [trpcClient] = useState(() => createTRPCClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={0}>
          <AutoRefreshProvider>
            <BrowserRouter>
              <DetailModalProvider>
                <BackgroundPrefetcher />
                <div className="min-h-screen bg-background">
                  <NavBar />
                  <main className="p-6">
                    <Routes>
                      <Route path="/" element={<ErrorBoundary><Overview /></ErrorBoundary>} />
                      <Route path="/reviews" element={<ErrorBoundary><PRReviews /></ErrorBoundary>} />
                      <Route path="/activity" element={<ErrorBoundary><ActivityTimeline /></ErrorBoundary>} />
                      <Route path="/sprint" element={<ErrorBoundary><SprintStatus /></ErrorBoundary>} />
                      <Route path="/epic/:epicKey?" element={<ErrorBoundary><EpicStatus /></ErrorBoundary>} />
                    </Routes>
                  </main>
                </div>
              </DetailModalProvider>
            </BrowserRouter>
          </AutoRefreshProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
