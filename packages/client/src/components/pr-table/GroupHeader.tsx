// T031: GroupHeader component (group label, PR count, collapsible)

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GroupHeaderProps {
  label: string;
  count: number;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export function GroupHeader({
  label,
  count,
  defaultExpanded = true,
  children,
}: GroupHeaderProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="mb-4">
      <Button
        variant="ghost"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-start gap-2 px-2 py-1.5 text-left"
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="font-semibold">{label}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {count}
        </span>
      </Button>
      {expanded && <div className="mt-1">{children}</div>}
    </div>
  );
}
