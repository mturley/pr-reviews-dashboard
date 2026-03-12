import { createContext, useContext, useState, useRef, useCallback, useMemo, type ReactNode } from "react";
import {
  GitPullRequest,
  GitMerge,
  CircleDot,
  CircleDashed,
  ExternalLink,
} from "lucide-react";
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
  const [isOpen, setIsOpen] = useState(false);
  const [target, setTarget] = useState<DetailTarget | null>(null);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [resolved, setResolved] = useState<ResolvedModalData>(EMPTY_MODAL);

  const [splitView, setSplitView] = useState(false);
  const [hideWhitespace, setHideWhitespace] = useState(false);

  // Use refs for data registry — mutations are synchronous, no re-render on registration
  const prMapRef = useRef(new Map<string, PullRequest>());
  const jiraMapRef = useRef(new Map<string, JiraIssue>());

  const registerPRs = useCallback((prs: PullRequest[]) => {
    for (const pr of prs) {
      prMapRef.current.set(pr.url.replace(/\/$/, ""), pr);
    }
  }, []);

  const registerJiraIssues = useCallback((issues: JiraIssue[]) => {
    for (const issue of issues) {
      jiraMapRef.current.set(issue.key, issue);
    }
  }, []);

  // Resolve data at open time — snapshot refs into state for rendering
  const open = useCallback((t: DetailTarget) => {
    const data = resolveTarget(t, prMapRef.current, jiraMapRef.current);
    setTarget(t);
    setResolved(data);
    setActiveTabIndex(0);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const { tabs, title, subtitle, headerIcon, externalUrl } = resolved;
  const activeTab = tabs[activeTabIndex] ?? tabs[0];

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
          activeTab?.type === "pr-diff" && splitView ? "max-w-[95vw]" : "max-w-5xl",
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
                    {target?.type === "pr" ? "Open in GitHub" : "Open in Jira"}
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
                <button
                  key={`${tab.type}-${tab.label}`}
                  onClick={() => setActiveTabIndex(i)}
                  className={`cursor-pointer px-3 py-2 text-xs font-medium transition-colors border-b-2 ${
                    i === activeTabIndex
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            {activeTab?.type === "pr-detail" && (
              <PRDetailContent
                pr={activeTab.pr}
                onNavigate={(t) => {
                  const idx = tabs.findIndex(
                    (tab) => tab.type === "jira-detail" && tab.label === t.key,
                  );
                  if (idx >= 0) setActiveTabIndex(idx);
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
                onNavigatePR={(url) => {
                  const idx = tabs.findIndex(
                    (tab) => tab.type === "pr-detail" && (tab as PRTab).pr.url === url,
                  );
                  if (idx >= 0) setActiveTabIndex(idx);
                }}
              />
            )}
            {!activeTab && target && (
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
    tabs.push({
      type: "jira-detail",
      label: jiraRef.key,
      issue: fullIssue ?? jiraRef,
      isPartial: !fullIssue,
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
): ResolvedModalData {
  const issue = jiraMap.get(key);
  if (!issue) {
    return { tabs: [], title: key, subtitle: "", headerIcon: null, externalUrl: `https://issues.redhat.com/browse/${key}` };
  }

  const tabs: Tab[] = [
    { type: "jira-detail", label: "Details", issue, isPartial: false },
  ];

  for (const prRef of issue.linkedPRs ?? []) {
    const fullPR = prMap.get(prRef.url.replace(/\/$/, ""));
    if (fullPR) {
      tabs.push({ type: "pr-detail", label: `#${fullPR.number}`, pr: fullPR });
    }
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
): ResolvedModalData {
  if (target.type === "pr") return resolvePR(target.url, prMap, jiraMap);
  return resolveJira(target.key, prMap, jiraMap);
}

function PRStateIcon({ state, isDraft }: { state: string; isDraft: boolean }) {
  if (state === "MERGED") return <GitMerge className="h-5 w-5 text-purple-600 dark:text-purple-400 shrink-0" />;
  if (state === "CLOSED") return <CircleDot className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />;
  if (isDraft) return <CircleDashed className="h-5 w-5 text-muted-foreground shrink-0" />;
  return <GitPullRequest className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />;
}
