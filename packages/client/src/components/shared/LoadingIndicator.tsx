// T019: Shared LoadingIndicator component

interface LoadingIndicatorProps {
  message?: string;
  className?: string;
}

export function LoadingIndicator({ message = "Loading...", className }: LoadingIndicatorProps) {
  return (
    <div className={`flex items-center gap-2 text-muted-foreground ${className ?? ""}`}>
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      <span className="text-sm">{message}</span>
    </div>
  );
}
