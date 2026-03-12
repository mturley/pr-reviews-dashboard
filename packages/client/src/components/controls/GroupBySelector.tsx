// T053: GroupBySelector component — toggle button-group

import type { GroupByOption } from "@/lib/url-state";

const OPTIONS: { value: GroupByOption; label: string }[] = [
  { value: "default", label: "My Stuff" },
  { value: "action", label: "Action Needed" },
  { value: "repository", label: "Repository" },
  { value: "epic", label: "Epic" },
  { value: "jiraPriority", label: "Jira Priority" },
  { value: "flat", label: "Flat" },
];

interface GroupBySelectorProps {
  value: GroupByOption;
  onChange: (value: GroupByOption) => void;
}

export function GroupBySelector({ value, onChange }: GroupBySelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Group by:</span>
      <div className="flex rounded-md border border-border overflow-hidden">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`cursor-pointer px-2.5 py-1 text-xs font-medium transition-colors border-r border-border last:border-r-0 ${
              value === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
