// T051: URL state serialization helpers

export type GroupByOption = "default" | "repository" | "epic" | "priority" | "flat";
export type SortByOption = "age" | "priority" | "reviewStatus" | "ci";

export interface ViewState {
  groupBy: GroupByOption;
  sortBy: SortByOption;
  perspective: string;
  filterRepo: string[];
  filterActionNeeded: boolean;
  filterDraft: boolean;
  staleHighlight: boolean;
}

const DEFAULTS: ViewState = {
  groupBy: "default",
  sortBy: "age",
  perspective: "",
  filterRepo: [],
  filterActionNeeded: false,
  filterDraft: false,
  staleHighlight: false,
};

export function parseViewState(params: URLSearchParams): ViewState {
  return {
    groupBy: (params.get("groupBy") as GroupByOption) ?? DEFAULTS.groupBy,
    sortBy: (params.get("sortBy") as SortByOption) ?? DEFAULTS.sortBy,
    perspective: params.get("perspective") ?? DEFAULTS.perspective,
    filterRepo: params.get("repo")?.split(",").filter(Boolean) ?? DEFAULTS.filterRepo,
    filterActionNeeded: params.get("action") === "1",
    filterDraft: params.get("draft") === "1",
    staleHighlight: params.get("stale") === "1",
  };
}

export function serializeViewState(state: Partial<ViewState>, current: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(current);

  if (state.groupBy !== undefined) {
    if (state.groupBy === DEFAULTS.groupBy) next.delete("groupBy");
    else next.set("groupBy", state.groupBy);
  }
  if (state.sortBy !== undefined) {
    if (state.sortBy === DEFAULTS.sortBy) next.delete("sortBy");
    else next.set("sortBy", state.sortBy);
  }
  if (state.perspective !== undefined) {
    if (state.perspective === DEFAULTS.perspective) next.delete("perspective");
    else next.set("perspective", state.perspective);
  }
  if (state.filterRepo !== undefined) {
    if (state.filterRepo.length === 0) next.delete("repo");
    else next.set("repo", state.filterRepo.join(","));
  }
  if (state.filterActionNeeded !== undefined) {
    if (state.filterActionNeeded) next.set("action", "1");
    else next.delete("action");
  }
  if (state.filterDraft !== undefined) {
    if (state.filterDraft) next.set("draft", "1");
    else next.delete("draft");
  }
  if (state.staleHighlight !== undefined) {
    if (state.staleHighlight) next.set("stale", "1");
    else next.delete("stale");
  }

  return next;
}
