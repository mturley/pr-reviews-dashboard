// T032: PRTable component using TanStack Table

import { Fragment, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";
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
import { columns, SORTABLE_COLUMNS, type PRRow } from "./columns";

// Cell-based card styling for each group tbody.
// With border-separate, we apply borders and rounded corners on individual cells
// to create a card-like appearance per group.
const groupCardStyles = [
  "[&_td]:bg-card [&_td]:border-border [&_td]:border-b",
  "[&_tr:first-child_td]:border-t",
  "[&_tr_td:first-child]:border-l [&_tr_td:last-child]:border-r",
  "[&_tr:first-child_td:first-child]:rounded-tl-lg [&_tr:first-child_td:last-child]:rounded-tr-lg",
  "[&_tr:last-child_td:first-child]:rounded-bl-lg [&_tr:last-child_td:last-child]:rounded-br-lg",
  "[&_tr:last-child_td]:border-b",
  "[&_tr:hover_td]:bg-muted/50",
].join(" ");

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
  sorting,
}: {
  group: PRGroup;
  rows: PRRow[];
  columnVisibility: VisibilityState | undefined;
  sorting: SortingState;
}) {
  const [expanded, setExpanded] = useState(true);

  const table = useReactTable({
    data: rows,
    columns: columns as ColumnDef<PRRow, unknown>[],
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      ...(columnVisibility ? { columnVisibility } : {}),
      sorting,
    },
    enableSortingRemoval: false,
  });

  const colCount = table.getVisibleFlatColumns().length;

  return (
    <TableBody className={groupCardStyles}>
      <TableRow
        className="cursor-pointer hover:!bg-transparent"
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell colSpan={colCount} className="py-2.5 px-3 !bg-muted/40 hover:!bg-muted/60">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-semibold">{group.label}</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
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
              className="py-4 text-left text-sm text-muted-foreground"
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
  // User-selected sort (single column). Tiebreakers are added implicitly.
  const [userSort, setUserSort] = useState<SortingState>([
    { id: "action", desc: false },
  ]);

  // Build full sorting state: user sort + implicit tiebreakers
  // When sorting by any column, tie-break by action needed, then jira priority
  const sorting = useMemo(() => {
    const result = [...userSort];
    const sortedIds = new Set(result.map((s) => s.id));
    if (!sortedIds.has("action")) {
      result.push({ id: "action", desc: false });
    }
    if (!sortedIds.has("jiraPriority")) {
      result.push({ id: "jiraPriority", desc: false });
    }
    return result;
  }, [userSort]);

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
    getSortedRowModel: getSortedRowModel(),
    state: {
      ...(columnVisibility ? { columnVisibility } : {}),
      sorting,
    },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      // Only keep the user's primary sort (first column), strip implicit tiebreakers
      setUserSort(next.slice(0, 1));
    },
    enableSortingRemoval: false,
  });

  return (
    <div>
      {isJiraLoading && (
        <p className="text-xs text-muted-foreground animate-pulse mb-2">
          Loading Jira data...
        </p>
      )}
      <Table className="border-separate border-spacing-0">
        <TableHeader>
          {headerTable.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-none hover:bg-transparent">
              {headerGroup.headers.map((header) => {
                const isSortable = SORTABLE_COLUMNS.has(header.id);
                const sorted = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    className={`border-none ${isSortable ? "cursor-pointer select-none hover:text-foreground" : ""}`}
                    onClick={isSortable ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <div className="flex items-center gap-1">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                      {isSortable && (
                        sorted === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-30" />
                        )
                      )}
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        {groups.map((group, index) => {
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
            <Fragment key={group.id}>
              {index > 0 && (
                <tbody aria-hidden>
                  <tr>
                    <td colSpan={99} className="h-6 p-0 border-none" />
                  </tr>
                </tbody>
              )}
              <CollapsibleGroup
                group={group}
                rows={rows}
                columnVisibility={columnVisibility}
                sorting={sorting}
              />
            </Fragment>
          );
        })}
      </Table>
    </div>
  );
}
