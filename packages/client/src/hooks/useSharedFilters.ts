// Shared filter state persisted to localStorage, used by Overview and PR Reviews tabs

import { useState, useCallback } from "react";

export interface SharedFilters {
  ignoreDrafts: boolean;
  ignoreOtherTeams: boolean;
  ignoreBots: boolean;
  filterActionNeeded: boolean;
}

const STORAGE_KEY = "dashboard-shared-filters";

const DEFAULTS: SharedFilters = {
  ignoreDrafts: false,
  ignoreOtherTeams: true,
  ignoreBots: true,
  filterActionNeeded: false,
};

function loadFilters(): SharedFilters {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULTS, ...JSON.parse(stored) };
  } catch {
    // ignore parse errors
  }
  return DEFAULTS;
}

function saveFilters(filters: SharedFilters) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
}

export function useSharedFilters() {
  const [filters, setFiltersState] = useState<SharedFilters>(loadFilters);

  const setFilters = useCallback((updates: Partial<SharedFilters>) => {
    setFiltersState((prev) => {
      const next = { ...prev, ...updates };
      saveFilters(next);
      return next;
    });
  }, []);

  return { filters, setFilters };
}
