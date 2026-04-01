// Overview route — responsive card grid with summary of all work

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Settings, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { trpc } from "../trpc";
import { isBot } from "@/lib/bot-users";
import { useAutoRefreshContext } from "@/hooks/useAutoRefreshContext";
import { useSharedFilters } from "@/hooks/useSharedFilters";
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

const OVERVIEW_SECTIONS = [
  "My Epics",
  "My Assigned Issues",
  "My PRs",
  "PRs I'm Reviewing",
  "Recommended Review Actions",
  "Team Issues in Review",
  "Team Issues in Testing",
  "Other Watched Issues",
] as const;

type OverviewSection = (typeof OVERVIEW_SECTIONS)[number];

interface ColumnLayout {
  left: OverviewSection[];
  right: OverviewSection[];
  hidden: OverviewSection[];
}

const DEFAULT_LAYOUT: ColumnLayout = {
  left: ["My Epics", "My Assigned Issues", "My PRs", "PRs I'm Reviewing"],
  right: ["Recommended Review Actions", "Team Issues in Review", "Team Issues in Testing", "Other Watched Issues"],
  hidden: [],
};

const LAYOUT_STORAGE_KEY = "overview-column-layout";

function loadLayout(): ColumnLayout {
  try {
    const stored = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ColumnLayout;
      // Validate all sections in left+right are accounted for (hidden is just a visibility set)
      const placed = new Set([...parsed.left, ...parsed.right]);
      if (OVERVIEW_SECTIONS.every((s) => placed.has(s)) && placed.size === OVERVIEW_SECTIONS.length) {
        // Ensure hidden only contains valid section names
        const validHidden = (parsed.hidden ?? []).filter((s: OverviewSection) => placed.has(s));
        return { ...parsed, hidden: validHidden };
      }
    }
  } catch { /* ignore */ }
  // Migrate from old visibility-only storage
  try {
    const oldStored = localStorage.getItem("overview-visible-sections");
    if (oldStored) {
      const visible = new Set(JSON.parse(oldStored) as OverviewSection[]);
      const hidden = OVERVIEW_SECTIONS.filter((s) => !visible.has(s));
      localStorage.removeItem("overview-visible-sections");
      const layout = { ...DEFAULT_LAYOUT, hidden };
      saveLayout(layout);
      return layout;
    }
  } catch { /* ignore */ }
  return DEFAULT_LAYOUT;
}

function saveLayout(layout: ColumnLayout) {
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
}

type ContainerId = "left" | "right";

// Custom collision detection: find which droppable container the pointer is in,
// then use closestCenter among only items in that container (+ the container itself).
const containerAwareCollision: CollisionDetection = (args) => {
  // First find which droppable containers the pointer is within
  const containerCollisions = pointerWithin({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (c) => c.id === "left" || c.id === "right",
    ),
  });

  if (containerCollisions.length > 0) {
    const targetContainerId = containerCollisions[0].id;
    // Now find closest item within that container (+ the container itself as fallback)
    const itemsInContainer = args.droppableContainers.filter(
      (c) =>
        c.id === targetContainerId ||
        c.data?.current?.containerId === targetContainerId,
    );
    const itemCollisions = closestCenter({
      ...args,
      droppableContainers: itemsInContainer,
    });
    if (itemCollisions.length > 0) return itemCollisions;
    // No items — return the container itself
    return containerCollisions;
  }

  // Fallback to closestCenter across everything
  return closestCenter(args);
};

// --- Sortable button component (drag handle only) ---

function SortableSectionButton({
  section,
  containerId,
  isHidden,
  onToggleVisibility,
}: {
  section: OverviewSection;
  containerId: ContainerId;
  isHidden: boolean;
  onToggleVisibility: (section: OverviewSection) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section, data: { containerId } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center">
      <Button
        variant={isHidden ? "outline" : "default"}
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={() => onToggleVisibility(section)}
      >
        <span
          ref={setActivatorNodeRef}
          className="cursor-grab active:cursor-grabbing flex items-center"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3 w-3 mr-1 opacity-50" />
        </span>
        {section}
      </Button>
    </div>
  );
}

// --- Droppable column container ---

function DroppableColumn({
  id,
  label,
  sections,
  hiddenSet,
  onToggleVisibility,
}: {
  id: ContainerId;
  label: string;
  sections: OverviewSection[];
  hiddenSet: Set<OverviewSection>;
  onToggleVisibility: (section: OverviewSection) => void;
}) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className="flex flex-wrap items-center gap-1 min-h-[32px]"
    >
      <span className="text-xs text-muted-foreground mr-1 whitespace-nowrap">{label}:</span>
      <SortableContext items={sections} strategy={horizontalListSortingStrategy}>
        {sections.map((section) => (
          <SortableSectionButton
            key={section}
            section={section}
            containerId={id}
            isHidden={hiddenSet.has(section)}
            onToggleVisibility={onToggleVisibility}
          />
        ))}
      </SortableContext>
      {sections.length === 0 && (
        <span className="text-xs text-muted-foreground italic">Drop sections here</span>
      )}
    </div>
  );
}

export default function Overview() {
  const configQuery = trpc.config.get.useQuery();
  const config = configQuery.data?.config;

  const { autoRefresh, setAutoRefresh, intervalMs, setIntervalMs, refetchInterval } =
    useAutoRefreshContext();

  // Shared filter state (persisted to localStorage, shared with /reviews)
  const { filters: sharedFilters, setFilters } = useSharedFilters();
  const [showOptions, setShowOptions] = useState(false);

  // Section layout state (persisted to localStorage)
  const [layout, setLayout] = useState<ColumnLayout>(loadLayout);
  const [activeId, setActiveId] = useState<OverviewSection | null>(null);
  const hiddenSet = useMemo(() => new Set(layout.hidden), [layout.hidden]);

  const toggleVisibility = useCallback((section: OverviewSection) => {
    setLayout((prev) => {
      const hiddenSet = new Set(prev.hidden);
      if (hiddenSet.has(section)) {
        hiddenSet.delete(section);
      } else {
        hiddenSet.add(section);
      }
      const next = { ...prev, hidden: [...hiddenSet] };
      saveLayout(next);
      return next;
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as OverviewSection);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const section = active.id as OverviewSection;
    const overId = over.id as string;

    setLayout((prev) => {
      // Find which column the dragged section is in
      const fromCol: ContainerId | null =
        prev.left.includes(section) ? "left" :
        prev.right.includes(section) ? "right" : null;
      if (!fromCol) return prev;

      // Determine target column: over could be a droppable container id or a sortable item
      let toCol: ContainerId;
      let overSection: OverviewSection | null = null;
      if (overId === "left" || overId === "right") {
        toCol = overId;
      } else {
        overSection = overId as OverviewSection;
        toCol = prev.left.includes(overSection) ? "left" :
                prev.right.includes(overSection) ? "right" : fromCol;
      }

      const next = { left: [...prev.left], right: [...prev.right], hidden: prev.hidden };

      if (fromCol === toCol) {
        // Same column reorder
        if (!overSection || section === overSection) return prev;
        const items = next[fromCol];
        const oldIndex = items.indexOf(section);
        const newIndex = items.indexOf(overSection);
        if (oldIndex !== -1 && newIndex !== -1) {
          next[fromCol] = arrayMove(items, oldIndex, newIndex);
        }
      } else {
        // Cross-column move
        next[fromCol] = next[fromCol].filter((s) => s !== section);
        if (overSection) {
          const overIndex = next[toCol].indexOf(overSection);
          next[toCol].splice(overIndex, 0, section);
        } else {
          // Dropped on the column container itself — append
          next[toCol].push(section);
        }
      }

      saveLayout(next);
      return next;
    });
  }, []);

  const teamMemberUsernames = useMemo(
    () => (config?.teamMembers ?? []).map((m) => m.githubUsername),
    [config?.teamMembers],
  );

  const data = useOverviewData({
    refetchInterval,
    config,
    filters: sharedFilters,
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
    if (sharedFilters.ignoreDrafts) prs = prs.filter((pr) => !pr.isDraft);
    if (sharedFilters.filterActionNeeded) prs = prs.filter((pr) => data.reviewStatuses.get(pr.id)?.action != null);
    return prs;
  }, [data.myPRs, sharedFilters.ignoreDrafts, sharedFilters.filterActionNeeded, data.reviewStatuses]);

  const filteredReviewingPRs = useMemo(() => {
    let prs = data.reviewingPRs;
    if (sharedFilters.ignoreDrafts) prs = prs.filter((pr) => !pr.isDraft);
    if (sharedFilters.ignoreOtherTeams && teamMemberUsernames.length > 0) {
      const teamSet = new Set(teamMemberUsernames.map((u) => u.toLowerCase()));
      prs = prs.filter((pr) => teamSet.has(pr.author.toLowerCase()));
    }
    if (sharedFilters.ignoreBots) prs = prs.filter((pr) => !isBot(pr.author));
    if (sharedFilters.filterActionNeeded) prs = prs.filter((pr) => data.reviewStatuses.get(pr.id)?.action != null);
    return prs;
  }, [data.reviewingPRs, sharedFilters.ignoreDrafts, sharedFilters.ignoreOtherTeams, sharedFilters.ignoreBots, sharedFilters.filterActionNeeded, teamMemberUsernames, data.reviewStatuses]);

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
  const filterLabels: string[] = [];
  if (sharedFilters.filterActionNeeded) filterLabels.push("Action needed only");
  if (sharedFilters.ignoreDrafts) filterLabels.push("Ignore drafts");
  if (sharedFilters.ignoreOtherTeams) filterLabels.push("Ignore PRs from other scrums");
  if (sharedFilters.ignoreBots) filterLabels.push("Ignore PRs from bots");

  // Helper to render a section card by name
  const renderSection = (section: OverviewSection) => {
    switch (section) {
      case "My Epics":
        return (
          <OverviewCard
            key={section}
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
              hideLinkedPRs
              isPRsLoading={data.isOverviewPRsLoading}
            />
          </OverviewCard>
        );
      case "My Assigned Issues":
        return (
          <OverviewCard
            key={section}
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
        );
      case "My PRs":
        return (
          <OverviewCard
            key={section}
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
        );
      case "PRs I'm Reviewing":
        return (
          <OverviewCard
            key={section}
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
        );
      case "Recommended Review Actions":
        return (
          <OverviewCard
            key={section}
            title="Recommended Review Actions"
            count={data.actions.length}
            isLoading={data.isGitHubLoading}
            emptyMessage="No review actions needed"
          >
            <ActionsPanel actions={data.actions} flat maxItems={10} />
          </OverviewCard>
        );
      case "Team Issues in Review":
        return config?.teamAreaLabelsFilter != null ? (
          <OverviewCard
            key={section}
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
          <OverviewCard key={section} title="Team Issues in Review" emptyMessage='Configure "teamAreaLabelsFilter" in config.local.json to see team issues'>
            <span />
          </OverviewCard>
        );
      case "Team Issues in Testing":
        return config?.teamAreaLabelsFilter != null ? (
          <OverviewCard
            key={section}
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
          <OverviewCard key={section} title="Team Issues in Testing" emptyMessage='Configure "teamAreaLabelsFilter" in config.local.json to see team issues'>
            <span />
          </OverviewCard>
        );
      case "Other Watched Issues":
        return (
          <OverviewCard
            key={section}
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
        );
    }
  };

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
          {filterLabels.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {filterLabels.join(", ")}
            </span>
          )}
        </div>
        {showOptions && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-1.5">
                <Switch checked={sharedFilters.filterActionNeeded} onCheckedChange={(v) => setFilters({ filterActionNeeded: v })} />
                <span className="text-xs">Action needed only</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Switch checked={sharedFilters.ignoreDrafts} onCheckedChange={(v) => setFilters({ ignoreDrafts: v })} />
                <span className="text-xs">Ignore drafts</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Switch checked={sharedFilters.ignoreOtherTeams} onCheckedChange={(v) => setFilters({ ignoreOtherTeams: v })} />
                <span className="text-xs">Ignore PRs from other scrums</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Switch checked={sharedFilters.ignoreBots} onCheckedChange={(v) => setFilters({ ignoreBots: v })} />
                <span className="text-xs">Ignore PRs from bots</span>
              </div>
            </div>

            {/* Section layout controls with drag-and-drop */}
            <DndContext
              sensors={sensors}
              collisionDetection={containerAwareCollision}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                <DroppableColumn
                  id="left"
                  label="Left column"
                  sections={layout.left}
                  hiddenSet={hiddenSet}
                  onToggleVisibility={toggleVisibility}
                />
                <div className="border-t border-border" />
                <DroppableColumn
                  id="right"
                  label="Right column"
                  sections={layout.right}
                  hiddenSet={hiddenSet}
                  onToggleVisibility={toggleVisibility}
                />
              </div>
              <DragOverlay>
                {activeId && (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-6 px-2 text-xs cursor-grabbing shadow-lg"
                  >
                    <GripVertical className="h-3 w-3 mr-1 opacity-50" />
                    {activeId}
                  </Button>
                )}
              </DragOverlay>
            </DndContext>
          </div>
        )}
      </div>

      {/* Two-column card layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          {layout.left.filter((s) => !hiddenSet.has(s)).map(renderSection)}
        </div>
        <div className="space-y-4">
          {layout.right.filter((s) => !hiddenSet.has(s)).map(renderSection)}
        </div>
      </div>
    </div>
  );
}
