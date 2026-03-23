// T018: App shell with React Router, tRPC provider, and nav layout

import { useState } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

function NavBar() {
  const { theme, setTheme } = useTheme();
  const { fontSize, setFontSize } = useFontSize();
  const links = [
    { to: "/", label: "Overview" },
    { to: "/reviews", label: "My PRs and Reviews" },
    { to: "/sprint", label: "Current Sprint Status" },
    { to: "/epic", label: "Epic Status" },
    { to: "/activity", label: "My Activity" },
  ];

  return (
    <nav aria-label="Main navigation" className="border-b border-border bg-card px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-lg font-semibold">GitHub + Jira Personal Sprint Dashboard</span>
          <div className="flex gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
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

export default function App() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 2 * 60 * 1000, // 2 minutes
        refetchOnWindowFocus: false,
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
