import { createContext, useContext, useState, useRef, useCallback, useMemo, type ReactNode } from "react";
import {
  GitPullRequest,
  GitMerge,
  CircleDot,
  CircleDashed,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { trpc } from "@/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PRDetailContent } from "./PRDetailContent";
import { JiraDetailContent } from "./JiraDetailContent";
import { DiffViewer } from "./DiffViewer";
import type { PullRequest, JiraIssueRef } from "../../../../server/src/types/pr";
import type { JiraIssue } from "../../../../server/src/types/jira";
import { formatUsername } from "@/lib/bot-users";
import { useJiraHost } from "@/hooks/useJiraHost";

// --- Types ---

export type DetailTarget =
  | { type: "pr"; url: string }
  | { type: "jira"; key: string };

interface DetailModalContextValue {
  open: (target: DetailTarget) => void;
  close: () => void;
  registerPRs: (prs: PullRequest[]) => void;
  registerJiraIssues: (issues: JiraIssue[]) => void;
}

const DetailModalContext = createContext<DetailModalContextValue | null>(null);

export function useDetailModal(): DetailModalContextValue {
  const ctx = useContext(DetailModalContext);
  if (!ctx) {
    throw new Error("useDetailModal must be used within DetailModalProvider");
  }
  return ctx;
}

// --- Tab types ---

interface PRTab {
  type: "pr-detail";
  label: string;
  pr: PullRequest;
}

interface PRDiffTab {
  type: "pr-diff";
  label: string;
  pr: PullRequest;
}

interface JiraTab {
  type: "jira-detail";
  label: string;
  issue: JiraIssue | JiraIssueRef;
  isPartial: boolean;
  resolvedPRs?: PullRequest[];
}

type Tab = PRTab | PRDiffTab | JiraTab;

interface ResolvedModalData {
  tabs: Tab[];
  title: string;
  subtitle: string;
  headerIcon: React.ReactNode;
  externalUrl: string;
}

const EMPTY_MODAL: ResolvedModalData = {
  tabs: [],
  title: "",
  subtitle: "",
  headerIcon: null,
  externalUrl: "",
};

// --- Provider ---

export function DetailModalProvider({ children }: { children: ReactNode }) {
  const jiraHost = useJiraHost();
  const [isOpen, setIsOpen] = useState(false);
  const [target, setTarget] = useState<DetailTarget | null>(null);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [resolved, setResolved] = useState<ResolvedModalData>(EMPTY_MODAL);

  const [splitView, setSplitView] = useState(false);
  const [hideWhitespace, setHideWhitespace] = useState(false);
  const [loadingJira, setLoadingJira] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Use refs for data registry — mutations are synchronous, no re-render on registration
  const prMapRef = useRef(new Map<string, PullRequest>());
  const jiraMapRef = useRef(new Map<string, JiraIssue>());
  const openKeyRef = useRef<string | null>(null);
  const isOpenRef = useRef(false);
  const targetRef = useRef<DetailTarget | null>(null);

  const utils = trpc.useUtils();

  // Re-resolve the current modal target using latest data from refs
  const reResolve = useCallback(() => {
    if (!isOpenRef.current || !targetRef.current) return;
    setResolved(resolveTarget(targetRef.current, prMapRef.current, jiraMapRef.current, jiraHost));
  }, [jiraHost]);

  const registerPRs = useCallback((prs: PullRequest[]) => {
    let changed = false;
    for (const pr of prs) {
      const key = pr.url.replace(/\/$/, "");
      const existing = prMapRef.current.get(key);
      if (!existing || existing.updatedAt !== pr.updatedAt) changed = true;
      prMapRef.current.set(key, pr);
    }
    if (changed) reResolve();
  }, [reResolve]);

  const registerJiraIssues = useCallback((issues: JiraIssue[]) => {
    let changed = false;
    for (const issue of issues) {
      const existing = jiraMapRef.current.get(issue.key);
      if (!existing || existing.updatedAt !== issue.updatedAt) changed = true;
      jiraMapRef.current.set(issue.key, issue);
    }
    if (changed) reResolve();
  }, [reResolve]);

  const fetchAndResolveJira = useCallback(async (key: string) => {
    setLoadingJira(true);
    setLoadError(null);
    try {
      const issue = await utils.jira.getIssue.fetch({ key });
      // Guard against stale response if modal was reopened for a different target
      if (openKeyRef.current !== key) return;
      jiraMapRef.current.set(issue.key, issue);
      setResolved(resolveJira(key, prMapRef.current, jiraMapRef.current, jiraHost));
    } catch (err) {
      if (openKeyRef.current !== key) return;
      setLoadError(err instanceof Error ? err.message : "Failed to load Jira issue");
    } finally {
      if (openKeyRef.current === key) setLoadingJira(false);
    }
  }, [utils, jiraHost]);

  const upgradePartialJiraTabs = useCallback(async (data: ResolvedModalData) => {
    const partialTabs = data.tabs.filter(
      (tab): tab is JiraTab => tab.type === "jira-detail" && (tab as JiraTab).isPartial,
    );
    if (partialTabs.length === 0) return;

    const results = await Promise.allSettled(
      partialTabs.map((tab) => utils.jira.getIssue.fetch({ key: tab.label })),
    );

    let anyUpgraded = false;
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        jiraMapRef.current.set(result.value.key, result.value);
        anyUpgraded = true;
      }
    }

    if (anyUpgraded) {
      // Re-resolve to pick up upgraded data
      setResolved((prev) => {
        const updatedTabs = prev.tabs.map((tab) => {
          if (tab.type !== "jira-detail") return tab;
          const jTab = tab as JiraTab;
          const fullIssue = jiraMapRef.current.get(jTab.label);
          if (fullIssue && jTab.isPartial) {
            const resolvedPRs: PullRequest[] = [];
            for (const prUrl of fullIssue.linkedPRUrls) {
              const fullPR = prMapRef.current.get(prUrl.replace(/\/$/, ""));
              if (fullPR) resolvedPRs.push(fullPR);
            }
            return { ...jTab, issue: fullIssue, isPartial: false, resolvedPRs };
          }
          return tab;
        });
        return { ...prev, tabs: updatedTabs };
      });
    }
  }, [utils]);

  // Fetch PR data not yet in the map — for linked PRs from Jira issues or for the target PR itself
  const fetchMissingPRs = useCallback(async (data: ResolvedModalData, targetKey: string | null) => {
    const missingUrls: string[] = [];

    // Check if the target PR itself is missing
    for (const tab of data.tabs) {
      if (tab.type === "pr-detail") {
        const url = (tab as PRTab).pr.url;
        if (!prMapRef.current.has(url.replace(/\/$/, ""))) missingUrls.push(url);
      }
    }

    // Check linked PR URLs from Jira issues in the resolved data
    for (const tab of data.tabs) {
      if (tab.type !== "jira-detail") continue;
      const jTab = tab as JiraTab;
      const fullIssue = jTab.issue;
      if ("linkedPRUrls" in fullIssue) {
        for (const url of fullIssue.linkedPRUrls) {
          const normalized = url.replace(/\/$/, "");
          if (!prMapRef.current.has(normalized) && !missingUrls.includes(url)) {
            missingUrls.push(url);
          }
        }
      }
    }

    if (missingUrls.length === 0) return;

    try {
      const result = await utils.github.getPRsByUrls.fetch({ prUrls: missingUrls });
      if (openKeyRef.current !== targetKey) return;
      for (const pr of result.prs) {
        prMapRef.current.set(pr.url.replace(/\/$/, ""), pr);
      }
      if (result.prs.length > 0) {
        reResolve();
      }
    } catch {
      // Silently ignore — PR data is supplementary
    }
  }, [utils, reResolve]);

  // Resolve data at open time — snapshot refs into state for rendering
  const open = useCallback((t: DetailTarget) => {
    const data = resolveTarget(t, prMapRef.current, jiraMapRef.current, jiraHost);
    openKeyRef.current = t.type === "jira" ? t.key : t.type === "pr" ? t.url : null;
    targetRef.current = t;
    isOpenRef.current = true;
    setTarget(t);
    setResolved(data);
    setActiveTabIndex(0);
    setLoadingJira(false);
    setLoadError(null);
    setIsOpen(true);

    if (t.type === "jira" && data.tabs.length === 0) {
      // Jira issue not in map — lazy-load it
      fetchAndResolveJira(t.key);
    } else if (data.tabs.some((tab) => tab.type === "jira-detail" && (tab as JiraTab).isPartial)) {
      // Upgrade partial Jira tabs in background
      upgradePartialJiraTabs(data);
    }

    // Fetch any missing PR data in the background
    fetchMissingPRs(data, openKeyRef.current);
  }, [fetchAndResolveJira, upgradePartialJiraTabs, fetchMissingPRs, jiraHost]);

  const close = useCallback(() => {
    isOpenRef.current = false;
    setIsOpen(false);
  }, []);

  const { tabs, title, subtitle, headerIcon, externalUrl } = resolved;
  const activeTab = tabs[activeTabIndex] ?? tabs[0];
  const activeJiraTab = activeTab?.type === "jira-detail" ? (activeTab as JiraTab) : null;

  // Find the index where related tabs begin
  const relatedStartIndex = tabs.findIndex((tab, i) =>
    (tab.type === "jira-detail" && target?.type === "pr") ||
    (tab.type === "pr-detail" && tab.label !== "Details" && target?.type === "jira" && i > 0),
  );

  const contextValue = useMemo(
    () => ({ open, close, registerPRs, registerJiraIssues }),
    [open, close, registerPRs, registerJiraIssues],
  );

  return (
    <DetailModalContext.Provider value={contextValue}>
      {children}
      <Dialog open={isOpen} onOpenChange={(v) => !v && close()}>
        <DialogContent className={cn(
          "max-h-[90vh] flex flex-col gap-0 p-0 transition-[max-width] duration-300",
          activeTab?.type === "pr-diff" && splitView ? "max-w-[95vw]" : "max-w-6xl",
        )}>
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
            <div className="flex items-center gap-2 pr-8">
              {headerIcon}
              <DialogTitle className="text-base font-semibold truncate">
                <a
                  href={externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {title}
                </a>
              </DialogTitle>
              {externalUrl && (
                <Button variant="outline" size="sm" asChild className="shrink-0 ml-auto mr-2">
                  <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    {target?.type === "pr" ? "Open on GitHub" : "Open on Jira"}
                  </a>
                </Button>
              )}
            </div>
            {subtitle && (
              <DialogDescription className="text-xs text-muted-foreground">
                {subtitle}
              </DialogDescription>
            )}
          </DialogHeader>

          {tabs.length > 1 && (
            <div className="flex items-center gap-0 px-6 border-b border-border bg-muted/30">
              {tabs.map((tab, i) => (
                <span key={`${tab.type}-${tab.label}`} className="flex items-center">
                  {i === relatedStartIndex && (
                    <span className="ml-4 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold select-none">
                      {tabs[relatedStartIndex]?.type === "jira-detail" ? "Linked Jira:" : "Linked PRs:"}
                    </span>
                  )}
                  <button
                    onClick={() => setActiveTabIndex(i)}
                    className={`cursor-pointer px-3 py-2 text-xs font-medium transition-colors border-b-2 flex items-center gap-1.5 max-w-[320px] ${
                      i === activeTabIndex
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <TabLabel tab={tab} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            {relatedStartIndex >= 0 && activeTabIndex >= relatedStartIndex && activeTab && (
              <div className="flex items-center gap-3 mb-3">
                <a
                  href={activeTab.type === "jira-detail"
                    ? (activeTab as JiraTab).issue.url ?? `https://${jiraHost}/browse/${activeTab.label}`
                    : activeTab.type === "pr-detail"
                      ? activeTab.pr.url
                      : "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold truncate flex-1 hover:underline"
                >
                  {activeTab.type === "jira-detail"
                    ? `${activeTab.label}: ${(activeTab as JiraTab).issue.summary}`
                    : activeTab.type === "pr-detail"
                      ? `#${activeTab.pr.number}: ${activeTab.pr.title}`
                      : activeTab.label}
                </a>
                <Button variant="outline" size="sm" asChild className="shrink-0">
                  <a
                    href={activeTab.type === "jira-detail"
                      ? (activeTab as JiraTab).issue.url ?? `https://${jiraHost}/browse/${activeTab.label}`
                      : activeTab.type === "pr-detail"
                        ? activeTab.pr.url
                        : "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gap-1.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {activeTab.type === "jira-detail" ? "Open on Jira" : "Open on GitHub"}
                  </a>
                </Button>
              </div>
            )}
            {activeTab?.type === "pr-detail" && (
              <PRDetailContent
                pr={activeTab.pr}
                onNavigate={(t) => {
                  const idx = tabs.findIndex(
                    (tab) => tab.type === "jira-detail" && tab.label === t.key,
                  );
                  if (idx >= 0) {
                    setActiveTabIndex(idx);
                  } else {
                    window.open(`https://${jiraHost}/browse/${t.key}`, "_blank", "noopener,noreferrer");
                  }
                }}
              />
            )}
            {activeTab?.type === "pr-diff" && (
              <DiffViewer
                pr={activeTab.pr}
                splitView={splitView}
                onSplitViewChange={setSplitView}
                hideWhitespace={hideWhitespace}
                onHideWhitespaceChange={setHideWhitespace}
              />
            )}
            {activeTab?.type === "jira-detail" && (
              <JiraDetailContent
                issue={activeTab.issue}
                isPartial={activeTab.isPartial}
                isLoading={activeJiraTab?.isPartial && loadingJira}
                resolvedPRs={activeJiraTab?.resolvedPRs}
                onNavigatePR={(url) => {
                  const idx = tabs.findIndex(
                    (tab) => tab.type === "pr-detail" && (tab as PRTab).pr.url === url,
                  );
                  if (idx >= 0) {
                    setActiveTabIndex(idx);
                  } else {
                    window.open(url, "_blank", "noopener,noreferrer");
                  }
                }}
              />
            )}
            {!activeTab && target && loadingJira && (
              <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading Jira issue...</span>
              </div>
            )}
            {!activeTab && target && loadError && (
              <div className="text-center py-8 text-muted-foreground space-y-3">
                <p>Failed to load Jira issue: {loadError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => target.type === "jira" && fetchAndResolveJira(target.key)}
                >
                  Retry
                </Button>
              </div>
            )}
            {!activeTab && target && !loadingJira && !loadError && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No details available for this item.</p>
              </div>
            )}
          </div>

        </DialogContent>
      </Dialog>
    </DetailModalContext.Provider>
  );
}

function resolvePR(
  url: string,
  prMap: Map<string, PullRequest>,
  jiraMap: Map<string, JiraIssue>,
): ResolvedModalData {
  const pr = prMap.get(url.replace(/\/$/, ""));
  if (!pr) {
    return { tabs: [], title: url, subtitle: "", headerIcon: null, externalUrl: url };
  }

  const tabs: Tab[] = [
    { type: "pr-detail", label: "Details", pr },
    { type: "pr-diff", label: "Files Changed", pr },
  ];

  for (const jiraRef of pr.linkedJiraIssues) {
    const fullIssue = jiraMap.get(jiraRef.key);
    // Resolve linked PRs for full Jira issues
    const resolvedPRs: PullRequest[] = [];
    if (fullIssue) {
      for (const prUrl of fullIssue.linkedPRUrls) {
        const fullPR = prMap.get(prUrl.replace(/\/$/, ""));
        if (fullPR) resolvedPRs.push(fullPR);
      }
    }
    tabs.push({
      type: "jira-detail",
      label: jiraRef.key,
      issue: fullIssue ?? jiraRef,
      isPartial: !fullIssue,
      resolvedPRs,
    });
  }

  return {
    tabs,
    title: `#${pr.number}: ${pr.title}`,
    subtitle: `${pr.repoOwner}/${pr.repoName} · ${formatUsername(pr.author)}`,
    headerIcon: <PRStateIcon state={pr.state} isDraft={pr.isDraft} />,
    externalUrl: pr.url,
  };
}

function resolveJira(
  key: string,
  prMap: Map<string, PullRequest>,
  jiraMap: Map<string, JiraIssue>,
  jiraHost: string,
): ResolvedModalData {
  const issue = jiraMap.get(key);
  if (!issue) {
    return { tabs: [], title: key, subtitle: "", headerIcon: null, externalUrl: `https://${jiraHost}/browse/${key}` };
  }

  // Resolve full PullRequest objects for linked PR URLs
  const resolvedPRs: PullRequest[] = [];
  for (const url of issue.linkedPRUrls) {
    const fullPR = prMap.get(url.replace(/\/$/, ""));
    if (fullPR) resolvedPRs.push(fullPR);
  }

  const tabs: Tab[] = [
    { type: "jira-detail", label: "Details", issue, isPartial: false, resolvedPRs },
  ];

  for (const pr of resolvedPRs) {
    tabs.push({ type: "pr-detail", label: `#${pr.number}`, pr });
  }

  return {
    tabs,
    title: `${issue.key}: ${issue.summary}`,
    subtitle: `${issue.type} · ${issue.assignee ?? "Unassigned"}`,
    headerIcon: issue.typeIconUrl ? (
      <img src={issue.typeIconUrl} alt={issue.type} className="h-5 w-5" />
    ) : null,
    externalUrl: issue.url,
  };
}

function resolveTarget(
  target: DetailTarget,
  prMap: Map<string, PullRequest>,
  jiraMap: Map<string, JiraIssue>,
  jiraHost: string,
): ResolvedModalData {
  if (target.type === "pr") return resolvePR(target.url, prMap, jiraMap);
  return resolveJira(target.key, prMap, jiraMap, jiraHost);
}

function PRStateIcon({ state, isDraft, size = "h-5 w-5" }: { state: string; isDraft: boolean; size?: string }) {
  if (state === "MERGED") return <GitMerge className={`${size} text-purple-600 dark:text-purple-400 shrink-0`} />;
  if (state === "CLOSED") return <CircleDot className={`${size} text-red-600 dark:text-red-400 shrink-0`} />;
  if (isDraft) return <CircleDashed className={`${size} text-muted-foreground shrink-0`} />;
  return <GitPullRequest className={`${size} text-green-600 dark:text-green-400 shrink-0`} />;
}

function TabLabel({ tab }: { tab: Tab }) {
  if (tab.type === "jira-detail" && tab.label !== "Details") {
    const jTab = tab as JiraTab;
    return (
      <>
        {jTab.issue.typeIconUrl && (
          <img src={jTab.issue.typeIconUrl} alt={jTab.issue.type} className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="shrink-0">{jTab.label}</span>
        <span className="truncate text-muted-foreground font-normal">{jTab.issue.summary}</span>
      </>
    );
  }
  if (tab.type === "pr-detail" && tab.label !== "Details") {
    return (
      <>
        <PRStateIcon state={tab.pr.state} isDraft={tab.pr.isDraft} size="h-3.5 w-3.5" />
        <span className="shrink-0">{tab.label}</span>
        <span className="shrink-0 text-muted-foreground font-normal">{tab.pr.repoName}</span>
        <span className="truncate text-muted-foreground font-normal">{tab.pr.title}</span>
      </>
    );
  }
  return <>{tab.label}</>;
}
