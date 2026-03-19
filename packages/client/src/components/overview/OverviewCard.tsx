// Overview card wrapper with title, count badge, loading/empty states

import { LoadingIndicator } from "@/components/shared/LoadingIndicator";

interface OverviewCardProps {
  title: string;
  count?: number;
  isLoading?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
}

export function OverviewCard({ title, count, isLoading, emptyMessage, children }: OverviewCardProps) {
  const isEmpty = !isLoading && count === 0;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
        <span className="text-sm font-semibold">{title}</span>
        {count != null && count > 0 && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {count}
          </span>
        )}
      </div>
      <div className="p-3">
        {isLoading ? (
          <LoadingIndicator message="Loading..." />
        ) : isEmpty ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {emptyMessage ?? "None"}
          </p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
