// T053: GroupBySelector component

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GroupByOption } from "@/lib/url-state";

const OPTIONS: { value: GroupByOption; label: string }[] = [
  { value: "default", label: "My Stuff" },
  { value: "repository", label: "Repository" },
  { value: "epic", label: "Epic" },
  { value: "priority", label: "Priority" },
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
      <Select value={value} onValueChange={(v) => onChange(v as GroupByOption)}>
        <SelectTrigger className="h-8 w-32 text-xs" aria-label="Group by">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
