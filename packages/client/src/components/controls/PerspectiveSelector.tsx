// T057: PerspectiveSelector component

import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
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
  const selectedValue = value || currentUser;
  const displayName =
    selectedValue === "team"
      ? "Whole Team"
      : teamMembers.find((m) => m.githubUsername === selectedValue)?.displayName ??
        selectedValue;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">View as:</span>
      <Select value={selectedValue} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-40 text-xs" aria-label="View as">
          <SelectValue>{displayName}</SelectValue>
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
          <SelectSeparator />
          <SelectItem value="team" className="text-xs font-semibold">
            Whole Team
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
