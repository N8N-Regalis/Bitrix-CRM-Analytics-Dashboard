import { useCallback, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/utils/cn";

/**
 * The numeric columns of the Presented Deals report.
 *
 * Three tables render the same report at different levels -- by team
 * (TeamLeaderboard), by associate (PresentedDeals) and by client (ClientReport)
 * -- and each row is a sum of the rows below it. Defining the columns once is
 * what keeps that true: a column added here appears in all three, and the three
 * reconcile column by column.
 *
 * `key` doubles as the field read off a row when sorting, so every row shape
 * feeding these tables carries these seven fields. Everything after Sourced Deals
 * breaks the presented figure down by where the deal went after Video
 * Presentation, so they share a `group` and render under one spanning
 * "Presented Deals" header.
 */
export const METRIC_COLUMNS = [
  { key: "total", label: "Sourced Deals", align: "right" },
  { key: "presented", label: "Total", align: "right", group: "Presented Deals" },
  { key: "accepted", label: "Accepted Deals", align: "right", group: "Presented Deals" },
  { key: "rejected", label: "Rejected Deals", align: "right", group: "Presented Deals" },
  { key: "autoAxed", label: "Auto-Axed Deals", align: "right", group: "Presented Deals" },
  { key: "onHold", label: "On Hold", align: "right", group: "Presented Deals" },
  { key: "awaiting", label: "Awaiting Response", align: "right", group: "Presented Deals" },
];

/** The numeric fields, in the order they are summed and rendered. */
export const METRICS = METRIC_COLUMNS.map((col) => col.key);

/** Per-column cell styling, so every level of the report inks a column the same. */
export const METRIC_CLASS = {
  total: "text-primary",
  presented: "text-foreground",
  accepted: "text-status-good",
  rejected: "text-status-critical",
  // Muted rather than another status colour: it is a kind of rejection, and the
  // fixed status palette has no shade left that reads as "critical, but quieter".
  autoAxed: "text-muted-foreground",
  onHold: "text-status-serious",
  awaiting: "text-status-warning",
};

/** One table's full column list: its own leading columns -- the label it groups
 * by, plus whatever else that level of the report knows about a row -- then the
 * shared metrics. */
export function withMetricColumns(...leadingColumns) {
  return [...leadingColumns, ...METRIC_COLUMNS];
}

/** Top header row: consecutive columns sharing a `group` collapse into a single
 * spanning cell, and everything else spans both header rows. */
export function buildHeaderGroups(columns) {
  return columns.reduce((groups, col) => {
    const previous = groups[groups.length - 1];
    if (col.group && previous?.group === col.group) previous.span += 1;
    else groups.push({ group: col.group, span: 1, col });
    return groups;
  }, []);
}

/** Sort state plus its toggle: a new field starts descending (the biggest
 * figures first, which is what these tables are read for), and re-picking the
 * current field flips it. */
export function useSort(field, direction = "desc") {
  const [sort, setSort] = useState({ field, direction });

  const toggleSort = useCallback((nextField) => {
    setSort((prev) =>
      prev.field === nextField
        ? { field: nextField, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { field: nextField, direction: "desc" },
    );
  }, []);

  return [sort, toggleSort];
}

function SortIcon({ active, direction }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />;
  return direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

export function SortButton({ column, sort, onSort }) {
  return (
    <button
      type="button"
      onClick={() => onSort(column.key)}
      className={cn(
        "inline-flex items-center gap-1 transition-colors hover:text-foreground",
        column.align === "right" && "flex-row-reverse",
      )}
    >
      {column.label}
      <SortIcon active={sort.field === column.key} direction={sort.direction} />
    </button>
  );
}

/** The two-row header the report uses: the spanning "Presented Deals" cell over
 * its breakdown columns, with every column's sort control. */
export function GroupedTableHead({ columns, sort, onSort }) {
  return (
    <thead>
      <tr>
        {buildHeaderGroups(columns).map(({ group, span, col }) =>
          group ? (
            <th
              key={group}
              colSpan={span}
              className="table-th border-b border-border text-center"
            >
              {group}
            </th>
          ) : (
            <th
              key={col.key}
              rowSpan={2}
              className={cn("table-th", col.align === "right" && "text-right")}
            >
              <SortButton column={col} sort={sort} onSort={onSort} />
            </th>
          ),
        )}
      </tr>
      <tr>
        {columns
          .filter((col) => col.group)
          .map((col) => (
            <th
              key={col.key}
              className={cn("table-th", col.align === "right" && "text-right")}
            >
              <SortButton column={col} sort={sort} onSort={onSort} />
            </th>
          ))}
      </tr>
    </thead>
  );
}
