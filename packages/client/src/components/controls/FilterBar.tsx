// T054: FilterBar component

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface FilterBarProps {
  actionNeeded: boolean;
  onActionNeededChange: (value: boolean) => void;
  showDraft: boolean;
  onShowDraftChange: (value: boolean) => void;
  ignoreOtherTeams: boolean;
  onIgnoreOtherTeamsChange: (value: boolean) => void;
  repos: string[];
  selectedRepos: string[];
  onRepoFilterChange: (repos: string[]) => void;
}

export function FilterBar({
  actionNeeded,
  onActionNeededChange,
  showDraft,
  onShowDraftChange,
  ignoreOtherTeams,
  onIgnoreOtherTeamsChange,
  repos,
  selectedRepos,
  onRepoFilterChange,
}: FilterBarProps) {
  return (
    <>
      <div className="flex items-center gap-1.5">
        <Switch
          checked={actionNeeded}
          onCheckedChange={onActionNeededChange}
          aria-label="Show only action needed"
        />
        <span className="text-xs">Action needed only</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Switch
          checked={!showDraft}
          onCheckedChange={(v) => onShowDraftChange(!v)}
          aria-label="Ignore draft PRs"
        />
        <span className="text-xs">Ignore drafts</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Switch
          checked={ignoreOtherTeams}
          onCheckedChange={onIgnoreOtherTeamsChange}
          aria-label="Ignore PRs from other scrums"
        />
        <span className="text-xs">Ignore PRs from other scrums</span>
      </div>

      {repos.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-muted-foreground">Repos:</span>
          {repos.map((repo) => {
            const isSelected = selectedRepos.includes(repo);
            return (
              <Button
                key={repo}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => {
                  if (isSelected) {
                    onRepoFilterChange(selectedRepos.filter((r) => r !== repo));
                  } else {
                    onRepoFilterChange([...selectedRepos, repo]);
                  }
                }}
              >
                {repo}
              </Button>
            );
          })}
        </div>
      )}
    </>
  );
}
