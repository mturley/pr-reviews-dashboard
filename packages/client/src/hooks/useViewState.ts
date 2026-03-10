// T052: useViewState hook — reads/writes URL search params

import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { parseViewState, serializeViewState, type ViewState } from "@/lib/url-state";

export function useViewState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const viewState = parseViewState(searchParams);

  const updateViewState = useCallback(
    (updates: Partial<ViewState>) => {
      setSearchParams((prev) => serializeViewState(updates, prev), { replace: true });
    },
    [setSearchParams],
  );

  return { viewState, updateViewState };
}
