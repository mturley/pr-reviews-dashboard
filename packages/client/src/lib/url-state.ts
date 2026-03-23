// T051: URL state serialization helpers

export type GroupByOption = "default" | "repository" | "epic" | "jiraPriority" | "action" | "flat";
export type SortByOption = "age" | "priority" | "reviewStatus" | "ci";

export interface ViewState {
  groupBy: GroupByOption;
  sortBy: SortByOption;
  perspective: string;
  filterRepo: string[];
}

const DEFAULTS: ViewState = {
  groupBy: "default",
  sortBy: "age",
  perspective: "",
  filterRepo: [],
};

export function parseViewState(params: URLSearchParams): ViewState {
  return {
    groupBy: (params.get("groupBy") as GroupByOption) ?? DEFAULTS.groupBy,
    sortBy: (params.get("sortBy") as SortByOption) ?? DEFAULTS.sortBy,
    perspective: params.get("perspective") ?? DEFAULTS.perspective,
    filterRepo: params.get("repo")?.split(",").filter(Boolean) ?? DEFAULTS.filterRepo,
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
  return next;
}
