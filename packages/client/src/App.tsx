// T018: App shell with React Router, tRPC provider, and nav layout

import { useState } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, createTRPCClient } from "./trpc";
import { TooltipProvider } from "@/components/ui/tooltip";
import PRReviews from "./routes/pr-reviews";
import ActivityTimeline from "./routes/activity-timeline";
import SprintStatus from "./routes/sprint-status";
import EpicStatus from "./routes/epic-status";

function NavBar() {
  const links = [
    { to: "/", label: "My PR Reviews" },
    { to: "/activity", label: "My Activity" },
    { to: "/sprint", label: "Sprint" },
    { to: "/epic", label: "Epic" },
  ];

  return (
    <nav aria-label="Main navigation" className="border-b border-border bg-card px-6 py-3">
      <div className="flex items-center gap-6">
        <span className="text-lg font-semibold">PR Reviews Dashboard</span>
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
    </nav>
  );
}

export default function App() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => createTRPCClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter>
            <div className="min-h-screen bg-background">
              <NavBar />
              <main className="p-6">
                <Routes>
                  <Route path="/" element={<PRReviews />} />
                  <Route path="/activity" element={<ActivityTimeline />} />
                  <Route path="/sprint" element={<SprintStatus />} />
                  <Route path="/epic" element={<EpicStatus />} />
                </Routes>
              </main>
            </div>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
