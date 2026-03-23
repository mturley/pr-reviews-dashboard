// Shared sort utilities for compact overview tables

import { useState } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

export type SortDirection = "asc" | "desc";

export const JIRA_PRIORITY_ORDER: Record<string, number> = {
  blocker: 0, critical: 1, major: 2, normal: 3, minor: 4,
};

// Higher value = more important, so descending sort = most important first
export function jiraPrioritySortValue(priorityName: string): number {
  return -(JIRA_PRIORITY_ORDER[priorityName.toLowerCase()] ?? 5);
}

const JIRA_STATE_ORDER: Record<string, number> = {
  review: 0, "code review": 0,
  testing: 1, "in testing": 1,
  "in progress": 2,
  backlog: 3,
  new: 4,
  closed: 5, resolved: 5, done: 5,
};

export function stateSortValue(state: string): number {
  return JIRA_STATE_ORDER[state.toLowerCase()] ?? 3;
}

export function SortIcon<T extends string>({ column, sortColumn, sortDirection }: {
  column: T;
  sortColumn: T;
  sortDirection: SortDirection;
}) {
  if (column !== sortColumn) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  return sortDirection === "asc"
    ? <ArrowUp className="h-3 w-3" />
    : <ArrowDown className="h-3 w-3" />;
}

export function useSort<T extends string>(defaultColumn: T, defaultDirection: SortDirection = "asc") {
  const [sortColumn, setSortColumn] = useState<T>(defaultColumn);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultDirection);

  function handleSort(column: T) {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  }

  return { sortColumn, sortDirection, handleSort };
}
