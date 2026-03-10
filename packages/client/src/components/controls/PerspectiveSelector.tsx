// T057: PerspectiveSelector component

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TeamMember } from "../../../../server/src/types/config";

interface PerspectiveSelectorProps {
  value: string;
  onChange: (value: string) => void;
  teamMembers: TeamMember[];
  currentUser: string;
}

export function PerspectiveSelector({
  value,
  onChange,
  teamMembers,
  currentUser,
}: PerspectiveSelectorProps) {
  const displayValue = value || currentUser || "Select...";

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">View as:</span>
      <Select value={value || currentUser} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-40 text-xs" aria-label="View as">
          <SelectValue>{displayValue}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {teamMembers.map((member) => (
            <SelectItem
              key={member.githubUsername}
              value={member.githubUsername}
              className="text-xs"
            >
              {member.displayName}
              {member.githubUsername === currentUser && " (you)"}
            </SelectItem>
          ))}
          <SelectItem value="team" className="text-xs">
            Whole Team
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
