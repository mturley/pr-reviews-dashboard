// T032: PRTable component using TanStack Table

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
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
import { GroupHeader } from "./GroupHeader";

interface PRTableProps {
  groups: PRGroup[];
  reviewStatuses: Map<string, ReviewStatusResult>;
  isJiraLoading?: boolean;
  visibleColumnIds?: string[];
  staleHighlight?: boolean;
  staleThresholdDays?: number;
}

function PRGroupTable({ prs, visibleColumnIds }: { prs: PRRow[]; visibleColumnIds?: string[] }) {
  const columnVisibility = visibleColumnIds
    ? Object.fromEntries(columns.map((c) => [c.id ?? "", visibleColumnIds.includes(c.id ?? "")]))
    : undefined;

  const table = useReactTable({
    data: prs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: columnVisibility ? { columnVisibility } : undefined,
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id}>
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
              No pull requests
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
        )}
      </TableBody>
    </Table>
  );
}

export function PRTable({ groups, reviewStatuses, isJiraLoading, visibleColumnIds, staleHighlight, staleThresholdDays }: PRTableProps) {
  return (
    <div className="space-y-2">
      {isJiraLoading && (
        <p className="text-xs text-muted-foreground animate-pulse">
          Loading Jira data...
        </p>
      )}
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
          staleHighlight,
          staleThresholdDays,
        }));

        return (
          <GroupHeader
            key={group.id}
            label={group.label}
            count={group.prs.length}
          >
            {group.prs.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {group.emptyMessage}
              </p>
            ) : (
              <PRGroupTable prs={rows} visibleColumnIds={visibleColumnIds} />
            )}
          </GroupHeader>
        );
      })}
    </div>
  );
}
