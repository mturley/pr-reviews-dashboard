// Overview route — responsive card grid with summary of all work

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { trpc } from "../trpc";
import { isBot } from "@/lib/bot-users";
import { useAutoRefreshContext } from "@/hooks/useAutoRefreshContext";
import { useOverviewData } from "@/hooks/useOverviewData";
import { useDetailModal } from "@/components/detail-modal/DetailModalProvider";
import { ActionsPanel } from "@/components/actions-panel/ActionsPanel";
import { RefreshControls } from "@/components/controls/RefreshControls";
import { LoadingProgress } from "@/components/shared/LoadingProgress";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { OverviewCard } from "@/components/overview/OverviewCard";
import { CompactPRTable } from "@/components/overview/CompactPRTable";
import { CompactJiraTable } from "@/components/overview/CompactJiraTable";
import type { LoadingPhase } from "@/hooks/useProgressiveData";

export default function Overview() {
  const configQuery = trpc.config.get.useQuery();
  const config = configQuery.data?.config;

  const { autoRefresh, setAutoRefresh, intervalMs, setIntervalMs, refetchInterval } =
    useAutoRefreshContext();

  // View options state (simple local state, not URL-driven for overview)
  const [showOptions, setShowOptions] = useState(false);
  const [filterActionNeeded, setFilterActionNeeded] = useState(false);
  const [ignoreDrafts, setIgnoreDrafts] = useState(true);
  const [ignoreOtherTeams, setIgnoreOtherTeams] = useState(true);
  const [ignoreBots, setIgnoreBots] = useState(true);

  const teamMemberUsernames = useMemo(
    () => (config?.teamMembers ?? []).map((m) => m.githubUsername),
    [config?.teamMembers],
  );

  const data = useOverviewData({
    refetchInterval,
    config,
    filters: { ignoreDrafts, ignoreOtherTeams, ignoreBots, filterActionNeeded },
    teamMemberUsernames,
  });

  // Register PR data with detail modal
  const { registerPRs, registerJiraIssues } = useDetailModal();
  useEffect(() => {
    if (data.overviewLinkedPRs.length > 0) registerPRs(data.overviewLinkedPRs);
  }, [data.overviewLinkedPRs, registerPRs]);

  useEffect(() => {
    const allIssues = [
      ...data.myEpics, ...data.myAssignedIssues,
      ...data.filterReviewIssues, ...data.filterTestingIssues,
      ...data.watchedIssues,
    ];
    if (allIssues.length > 0) registerJiraIssues(allIssues);
  }, [data.myEpics, data.myAssignedIssues, data.filterReviewIssues, data.filterTestingIssues, data.watchedIssues, registerJiraIssues]);

  const filteredMyPRs = useMemo(() => {
    let prs = data.myPRs;
    if (ignoreDrafts) prs = prs.filter((pr) => !pr.isDraft);
    if (filterActionNeeded) prs = prs.filter((pr) => data.reviewStatuses.get(pr.id)?.action != null);
    return prs;
  }, [data.myPRs, ignoreDrafts, filterActionNeeded, data.reviewStatuses]);

  const filteredReviewingPRs = useMemo(() => {
    let prs = data.reviewingPRs;
    if (ignoreDrafts) prs = prs.filter((pr) => !pr.isDraft);
    if (ignoreOtherTeams && teamMemberUsernames.length > 0) {
      const teamSet = new Set(teamMemberUsernames.map((u) => u.toLowerCase()));
      prs = prs.filter((pr) => teamSet.has(pr.author.toLowerCase()));
    }
    if (ignoreBots) prs = prs.filter((pr) => !isBot(pr.author));
    if (filterActionNeeded) prs = prs.filter((pr) => data.reviewStatuses.get(pr.id)?.action != null);
    return prs;
  }, [data.reviewingPRs, ignoreDrafts, ignoreOtherTeams, ignoreBots, filterActionNeeded, teamMemberUsernames, data.reviewStatuses]);

  const configPhase: LoadingPhase = {
    label: "Configuration",
    status: configQuery.isLoading ? "active"
      : configQuery.isError ? "error"
      : configQuery.isSuccess ? "done" : "pending",
    detail: configQuery.error?.message,
  };

  const allPhases = [configPhase, ...data.phases];

  if (configQuery.isLoading) {
    return (
      <div className="space-y-4">
        <LoadingProgress phases={allPhases} />
      </div>
    );
  }

  if (configQuery.error) {
    return (
      <div className="space-y-4">
        <LoadingProgress phases={allPhases} />
        <ErrorBanner message={`Config error: ${configQuery.error.message}`} />
      </div>
    );
  }

  // Active filter summary
  const filters: string[] = [];
  if (filterActionNeeded) filters.push("Action needed only");
  if (ignoreDrafts) filters.push("Ignore drafts");
  if (ignoreOtherTeams) filters.push("Ignore PRs from other scrums");
  if (ignoreBots) filters.push("Ignore PRs from bots");

  return (
    <div className="space-y-4">
      <LoadingProgress phases={allPhases} />

      {data.githubError && (
        <ErrorBanner message={`GitHub error: ${data.githubError.message}`} rateLimitResetAt={data.rateLimitResetAt} />
      )}
      {data.jiraError && (
        <ErrorBanner message={`Jira error: ${data.jiraError.message}`} />
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Overview
          {data.sprintName && (
            <Link
              to="/sprint"
              className="ml-2 text-base font-normal text-blue-600 dark:text-blue-400 hover:underline"
            >
              {data.sprintName}
            </Link>
          )}
        </h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {data.githubFetchedAt && (
              <span>GitHub: {new Date(data.githubFetchedAt).toLocaleTimeString()}</span>
            )}
            {data.jiraFetchedAt && (
              <span>Jira: {new Date(data.jiraFetchedAt).toLocaleTimeString()}</span>
            )}
            {data.rateLimitRemaining !== null && (
              <span>
                GitHub API: {data.rateLimitRemaining} requests remaining
              </span>
            )}
          </div>
          <RefreshControls
            autoRefresh={autoRefresh}
            onAutoRefreshChange={setAutoRefresh}
            intervalMs={intervalMs}
            onIntervalChange={setIntervalMs}
            onManualRefresh={data.refetch}
            isFetching={data.isFetching}
          />
        </div>
      </div>

      {/* View options */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowOptions(!showOptions)}
          >
            <Settings className="h-4 w-4" />
            {showOptions ? "Hide view options" : "Show view options"}
          </Button>
          {filters.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {filters.join(", ")}
            </span>
          )}
        </div>
        {showOptions && (
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-1.5">
              <Switch checked={filterActionNeeded} onCheckedChange={setFilterActionNeeded} />
              <span className="text-xs">Action needed only</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Switch checked={ignoreDrafts} onCheckedChange={setIgnoreDrafts} />
              <span className="text-xs">Ignore drafts</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Switch checked={ignoreOtherTeams} onCheckedChange={setIgnoreOtherTeams} />
              <span className="text-xs">Ignore PRs from other scrums</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Switch checked={ignoreBots} onCheckedChange={setIgnoreBots} />
              <span className="text-xs">Ignore PRs from bots</span>
            </div>
          </div>
        )}
      </div>

      {/* Responsive 2-column masonry layout */}
      <div className="columns-1 lg:columns-2 gap-4 space-y-4">
        {/* Card 1: My Epics */}
        <OverviewCard
          title="My Epics"
          count={data.myEpics.length}
          isLoading={!config?.jiraAccountId ? false : data.isJiraLoading && data.myEpics.length === 0}
          emptyMessage="No active epics assigned to you"
        >
          <CompactJiraTable
            issues={data.myEpics}
            linkedPRs={data.overviewLinkedPRs}
            viewer={config?.githubIdentity ?? ""}
            hideAssignee
            isPRsLoading={data.isOverviewPRsLoading}
          />
        </OverviewCard>

        {/* Card 2: My Assigned Issues */}
        <OverviewCard
          title="My Assigned Issues"
          count={data.myAssignedIssues.length}
          isLoading={!config?.jiraAccountId ? false : data.isJiraLoading && data.myAssignedIssues.length === 0}
          emptyMessage="No active issues assigned to you"
        >
          <CompactJiraTable
            issues={data.myAssignedIssues}
            linkedPRs={data.overviewLinkedPRs}
            viewer={config?.githubIdentity ?? ""}
            hideAssignee
            isPRsLoading={data.isOverviewPRsLoading}
          />
        </OverviewCard>

        {/* Card 3: My PRs */}
        <OverviewCard
          title="My PRs"
          count={filteredMyPRs.length}
          isLoading={data.isGitHubLoading}
          emptyMessage="No open PRs authored by you"
        >
          <CompactPRTable
            prs={filteredMyPRs}
            reviewStatuses={data.reviewStatuses}
            hideAuthor
          />
        </OverviewCard>

        {/* Card 4: Recommended Review Actions */}
        <OverviewCard
          title="Recommended Review Actions"
          count={data.actions.length}
          isLoading={data.isGitHubLoading}
          emptyMessage="No review actions needed"
        >
          <ActionsPanel actions={data.actions} flat maxItems={10} />
        </OverviewCard>

        {/* Card 5: PRs I'm Reviewing */}
        <OverviewCard
          title="PRs I'm Reviewing"
          count={filteredReviewingPRs.length}
          isLoading={data.isGitHubLoading}
          emptyMessage="No PRs to review"
        >
          <CompactPRTable
            prs={filteredReviewingPRs}
            reviewStatuses={data.reviewStatuses}
          />
        </OverviewCard>

        {/* Card 6: Team Issues in Review */}
        {config?.teamAreaLabelsFilter != null ? (
          <OverviewCard
            title="Team Issues in Review"
            count={data.filterReviewIssues.length}
            isLoading={data.filterReviewIssues.length === 0 && data.isFetching}
            emptyMessage="No team issues in Review state"
          >
            <CompactJiraTable
              issues={data.filterReviewIssues}
              linkedPRs={data.overviewLinkedPRs}
              viewer={config?.githubIdentity ?? ""}
              isPRsLoading={data.isOverviewPRsLoading}
            />
          </OverviewCard>
        ) : (
          <OverviewCard title="Team Issues in Review" emptyMessage='Configure "teamAreaLabelsFilter" in config.local.json to see team issues'>
            <span />
          </OverviewCard>
        )}

        {/* Card 7: Team Issues in Testing */}
        {config?.teamAreaLabelsFilter != null ? (
          <OverviewCard
            title="Team Issues in Testing"
            count={data.filterTestingIssues.length}
            isLoading={data.filterTestingIssues.length === 0 && data.isFetching}
            emptyMessage="No team issues in Testing state"
          >
            <CompactJiraTable
              issues={data.filterTestingIssues}
              linkedPRs={data.overviewLinkedPRs}
              viewer={config?.githubIdentity ?? ""}
              isPRsLoading={data.isOverviewPRsLoading}
            />
          </OverviewCard>
        ) : (
          <OverviewCard title="Team Issues in Testing" emptyMessage='Configure "teamAreaLabelsFilter" in config.local.json to see team issues'>
            <span />
          </OverviewCard>
        )}

        {/* Card 8: Other Watched Issues */}
        <OverviewCard
          title="Other Watched Issues"
          count={data.watchedIssues.length}
          isLoading={!config?.jiraAccountId ? false : data.watchedIssues.length === 0 && data.isFetching}
          emptyMessage="No other watched issues"
        >
          <CompactJiraTable
            issues={data.watchedIssues}
            linkedPRs={data.overviewLinkedPRs}
            viewer={config?.githubIdentity ?? ""}
            isPRsLoading={data.isOverviewPRsLoading}
          />
        </OverviewCard>
      </div>
    </div>
  );
}
