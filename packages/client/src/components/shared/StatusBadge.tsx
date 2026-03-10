// T021: Shared StatusBadge component (color-coded badge with text label)

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusVariant = "success" | "warning" | "danger" | "info" | "neutral";

interface StatusBadgeProps {
  label: string;
  variant?: StatusVariant;
  className?: string;
}

const variantClasses: Record<StatusVariant, string> = {
  success: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800",
  warning: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800",
  danger: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
  info: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800",
  neutral: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ label, variant = "neutral", className }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(variantClasses[variant], className)}>
      {label}
    </Badge>
  );
}
