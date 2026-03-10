// T020: Shared ErrorBanner component

interface ErrorBannerProps {
  message: string;
  rateLimitResetAt?: string | null;
  className?: string;
}

export function ErrorBanner({ message, rateLimitResetAt, className }: ErrorBannerProps) {
  const resetTime = rateLimitResetAt ? new Date(rateLimitResetAt).toLocaleTimeString() : null;

  return (
    <div
      role="alert"
      className={`rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive ${className ?? ""}`}
    >
      <p className="font-medium">{message}</p>
      {resetTime && (
        <p className="mt-1 text-xs">Rate limit resets at {resetTime}</p>
      )}
    </div>
  );
}
