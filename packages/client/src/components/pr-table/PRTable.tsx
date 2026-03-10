// T032: PRTable component using TanStack Table

import { useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
} from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PRGroup } from "../../../../server/src/types/pr.js";
import type { ReviewStatusResult } from "../../../../server/src/types/pr.js";
import { columns, type PRRow } from "./columns";

interface PRTableProps {
  groups: PRGroup[];
  reviewStatuses: Map<string, ReviewStatusResult>;
  isJiraLoading?: boolean;
  visibleColumnIds?: string[];
}

function CollapsibleGroup({
  group,
  rows,
  columnVisibility,
}: {
  group: PRGroup;
  rows: PRRow[];
  columnVisibility: VisibilityState | undefined;
}) {
  const [expanded, setExpanded] = useState(true);

  const table = useReactTable({
    data: rows,
    columns: columns as ColumnDef<PRRow, unknown>[],
    getCoreRowModel: getCoreRowModel(),
    state: columnVisibility ? { columnVisibility } : undefined,
  });

  const colCount = table.getVisibleFlatColumns().length;

  return (
    <TableBody>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell colSpan={colCount} className="py-2 px-2">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span className="font-semibold">{group.label}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {group.prs.length}
            </span>
          </div>
        </TableCell>
      </TableRow>
      {expanded &&
        (table.getRowModel().rows.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={colCount}
              className="py-4 text-center text-sm text-muted-foreground"
            >
              {group.emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        ))}
    </TableBody>
  );
}

export function PRTable({
  groups,
  reviewStatuses,
  isJiraLoading,
  visibleColumnIds,
}: PRTableProps) {
  const columnVisibility = visibleColumnIds
    ? Object.fromEntries(
        columns.map((c) => [c.id ?? "", visibleColumnIds.includes(c.id ?? "")]),
      )
    : undefined;

  // Header-only table instance for consistent column rendering
  const headerTable = useReactTable({
    data: [],
    columns: columns as ColumnDef<PRRow, unknown>[],
    getCoreRowModel: getCoreRowModel(),
    state: columnVisibility ? { columnVisibility } : undefined,
  });

  return (
    <div>
      {isJiraLoading && (
        <p className="text-xs text-muted-foreground animate-pulse mb-2">
          Loading Jira data...
        </p>
      )}
      <Table>
        <TableHeader>
          {headerTable.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        {groups.map((group) => {
          const rows: PRRow[] = group.prs.map((pr) => ({
            pr,
            reviewStatus: reviewStatuses.get(pr.id) ?? {
              status: "Awaiting Review" as const,
              priority: null,
              parenthetical: "",
              action: null,
              reviewerBreakdown: [],
            },
          }));

          return (
            <CollapsibleGroup
              key={group.id}
              group={group}
              rows={rows}
              columnVisibility={columnVisibility}
            />
          );
        })}
      </Table>
    </div>
  );
}
