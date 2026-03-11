// T055: ColumnCustomizer modal

import { useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: "action", label: "Action Needed", visible: true },
  { id: "title", label: "PR", visible: true },
  { id: "author", label: "Author", visible: true },
  { id: "age", label: "Created", visible: true },
  { id: "updated", label: "Updated", visible: true },
  { id: "reviewStatus", label: "Review Status", visible: true },
  { id: "jiraKey", label: "Jira", visible: true },
  { id: "jiraPriority", label: "Priority", visible: true },
  { id: "jiraState", label: "Jira Status", visible: true },
  { id: "jiraAssignee", label: "Assignee", visible: true },
  { id: "jiraEpic", label: "Epic", visible: true },
];

interface ColumnCustomizerProps {
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
}

export function ColumnCustomizer({ columns, onColumnsChange }: ColumnCustomizerProps) {
  const cols = columns.length > 0 ? columns : DEFAULT_COLUMNS;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings2 className="h-3.5 w-3.5" />
          Columns
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Customize Columns</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {cols.map((col) => (
            <div key={col.id} className="flex items-center justify-between">
              <span className="text-sm">{col.label}</span>
              <Switch
                checked={col.visible}
                onCheckedChange={(checked) => {
                  onColumnsChange(
                    cols.map((c) => (c.id === col.id ? { ...c, visible: checked } : c)),
                  );
                }}
                aria-label={`Toggle ${col.label} column`}
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useColumnConfig() {
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  return { columns, setColumns, visibleColumnIds: columns.filter((c) => c.visible).map((c) => c.id) };
}
