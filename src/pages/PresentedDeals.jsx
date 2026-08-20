import { Fragment, useState, useMemo } from "react";
import {
  Search,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { InfoCard } from "@/components/cards/InfoCard";
import { FilterBar } from "@/components/filters/FilterBar";
import { DateRangeFilter } from "@/components/filters/DateRangeFilter";
import { TeamFilter } from "@/components/filters/TeamFilter";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { TableSkeleton } from "@/components/common/LoadingSkeleton";
import { TeamLeaderboard } from "@/components/tables/TeamLeaderboard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSubmissions } from "@/hooks/useSubmissions";
import { NO_TEAM } from "@/utils/dealMeta";
import { describeRange } from "@/utils/dateRange";
import { downloadCsv, downloadXlsx } from "@/utils/exportFile";
import {
  buildPresentedDealsSheets,
  buildPresentedSheet,
  buildSourcedSheet,
  presentedDealsFileName,
} from "@/utils/presentedDealsExport";
import { formatNumber } from "@/utils/format";
import { cn } from "@/utils/cn";

// `key` doubles as the field read off each associate row when sorting.
// Everything after Total breaks the presented figure down by where the deal
// went after Video Presentation, so they share a `group` and render under one
// spanning "Presented Deals" header.
const COLUMNS = [
  { key: "name", label: "Associate / Client" },
  { key: "total", label: "Sourced Deals", align: "right" },
  { key: "presented", label: "Total", align: "right", group: "Presented Deals" },
  { key: "accepted", label: "Accepted Deals", align: "right", group: "Presented Deals" },
  { key: "rejected", label: "Rejected Deals", align: "right", group: "Presented Deals" },
  { key: "onHold", label: "On Hold", align: "right", group: "Presented Deals" },
  { key: "awaiting", label: "Awaiting Response", align: "right", group: "Presented Deals" },
];

// Top header row: consecutive columns sharing a `group` collapse into a single
// spanning cell, and everything else spans both header rows.
const HEADER_GROUPS = COLUMNS.reduce((groups, col) => {
  const previous = groups[groups.length - 1];
  if (col.group && previous?.group === col.group) previous.span += 1;
  else groups.push({ group: col.group, span: 1, col });
  return groups;
}, []);

// Second header row: only the grouped columns, which carry the sort controls.
const GROUPED_COLUMNS = COLUMNS.filter((col) => col.group);

function SortIcon({ active, direction }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />;
  return direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

function SortButton({ column, sort, onSort }) {
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

export default function PresentedDeals() {
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [search, setSearch] = useState("");
  const [team, setTeam] = useState("All");
  // Dismissed associates are hidden by default -- the usual question is about
  // the current roster, so seeing departed staff is the opt-in.
  const [excludeDismissed, setExcludeDismissed] = useState(true);
  const [sort, setSort] = useState({ field: "total", direction: "desc" });
  const [expandedAssociates, setExpandedAssociates] = useState(new Set());
  const [isExporting, setIsExporting] = useState(false);

  const { presentedDealsData, teams, getExportRows, appliedRange, isLoading, isError, error } =
    useSubmissions(dateFrom, dateTo);

  // The teams the roster still staffs (see listTeams), plus a bucket for the
  // associates it records no team for -- departed staff and anyone whose name
  // never matched a roster row, who would otherwise only ever be reachable
  // through "All Teams".
  const teamOptions = useMemo(
    () =>
      [...teams, NO_TEAM].map((name) => ({ value: name, label: name })),
    [teams],
  );

  const hasActiveFilters =
    dateFrom !== null ||
    dateTo !== null ||
    search !== "" ||
    team !== "All" ||
    !excludeDismissed;
  const appliedRangeLabel = describeRange(
    appliedRange.dateFrom,
    appliedRange.dateTo,
  );

  const handleReset = () => {
    setDateFrom(null);
    setDateTo(null);
    setSearch("");
    setTeam("All");
    setExcludeDismissed(true);
  };

  function toggleSort(field) {
    setSort((prev) =>
      prev.field === field
        ? { field, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { field, direction: "desc" },
    );
  }

  const filteredData = useMemo(() => {
    let result = presentedDealsData;
    // Whole associates in or out, like the search below -- their client rows
    // belong to them, so the breakdown follows without being filtered itself.
    if (team !== "All") {
      result = result.filter((associate) => associate.team === team);
    }
    // Departed staff still own their historical deals, so they are in the rows
    // by default; this drops them and everything they sourced or presented,
    // leaving the figures to describe only people still with the company.
    if (excludeDismissed) {
      result = result.filter((associate) => !associate.isDismissed);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((associate) =>
        associate.name.toLowerCase().includes(q) ||
        associate.clients.some((client) =>
          client.clientName.toLowerCase().includes(q)
        )
      );
    }
    return result;
  }, [presentedDealsData, search, team, excludeDismissed]);

  const sortedData = useMemo(() => {
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...filteredData].sort((a, b) => {
      if (sort.field === "name") return a.name.localeCompare(b.name) * dir;
      const [av, bv] = [a[sort.field] || 0, b[sort.field] || 0];
      return (av > bv ? 1 : av < bv ? -1 : 0) * dir;
    });
  }, [filteredData, sort]);

  // Derived from the same rows the table renders, so the totals always agree
  // with what's on screen when a search or date range is applied.
  const stats = useMemo(
    () => ({
      totalAssociates: filteredData.length,
      totalDeals: filteredData.reduce((sum, a) => sum + a.total, 0),
      totalPresented: filteredData.reduce((sum, a) => sum + a.presented, 0),
      totalAccepted: filteredData.reduce((sum, a) => sum + a.accepted, 0),
      totalRejected: filteredData.reduce((sum, a) => sum + a.rejected, 0),
      totalOnHold: filteredData.reduce((sum, a) => sum + a.onHold, 0),
      totalAwaiting: filteredData.reduce((sum, a) => sum + a.awaiting, 0),
      totalClients: new Set(
        filteredData.flatMap((a) => a.clients.map((c) => c.clientName)),
      ).size,
    }),
    [filteredData],
  );

  // The rows behind whatever the table is currently showing. `filteredData`
  // carries the search, the hook carries the date range, so passing the visible
  // associate names is enough to reproduce the on-screen selection exactly.
  // Gathered on click rather than on render -- it copies every submission row.
  const collectRows = () => getExportRows(filteredData.map((a) => a.name));

  const baseFileName = presentedDealsFileName(
    appliedRange.dateFrom,
    appliedRange.dateTo,
  );

  /**
   * Runs one export. The file is assembled on the main thread and the Sourced
   * tab can run to six figures of rows, so the click yields to the browser
   * before starting -- otherwise the button never repaints and the page looks
   * hung for the seconds the build takes.
   */
  function runExport(build) {
    setIsExporting(true);
    setTimeout(() => {
      try {
        toast.success(build());
      } catch (err) {
        toast.error(`Export failed: ${err?.message || "unknown error"}`);
      } finally {
        setIsExporting(false);
      }
    }, 50);
  }

  const exported = (count, noun) =>
    `Exported ${formatNumber(count)} ${noun} row${count === 1 ? "" : "s"}`;

  const exportWorkbook = () =>
    runExport(() => {
      const rows = collectRows();
      downloadXlsx(`${baseFileName}.xlsx`, buildPresentedDealsSheets(rows));
      return `Exported ${formatNumber(rows.sourced.length)} sourced and ${formatNumber(
        rows.presented.length,
      )} presented deal rows`;
    });

  const exportSourcedCsv = () =>
    runExport(() => {
      const { sourced } = collectRows();
      downloadCsv(`${baseFileName}_sourced.csv`, buildSourcedSheet(sourced));
      return exported(sourced.length, "sourced");
    });

  const exportPresentedCsv = () =>
    runExport(() => {
      const { presented } = collectRows();
      downloadCsv(`${baseFileName}_presented-deals.csv`, buildPresentedSheet(presented));
      return exported(presented.length, "presented deal");
    });

  const toggleAssociate = (associateName) => {
    const newExpanded = new Set(expandedAssociates);
    if (newExpanded.has(associateName)) {
      newExpanded.delete(associateName);
    } else {
      newExpanded.add(associateName);
    }
    setExpandedAssociates(newExpanded);
  };

  return (
    <PageContainer
      title="Presented Deals"
      subtitle="Presented deals grouped by associate and client"
      isLoading={isLoading}
    >
      {isError ? (
        <ErrorState message={error?.message || "Failed to load data"} />
      ) : (
        <div className="space-y-6">
          <FilterBar onReset={handleReset} hasActiveFilters={hasActiveFilters}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                type="search"
                placeholder="Search associate or client name..."
                className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-56"
              />
            </div>
            <TeamFilter value={team} onChange={setTeam} options={teamOptions} />
            <label className="flex h-9 cursor-pointer select-none items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm text-foreground transition-colors hover:bg-muted">
              <input
                type="checkbox"
                checked={excludeDismissed}
                onChange={(e) => setExcludeDismissed(e.target.checked)}
                className="h-3.5 w-3.5 cursor-pointer accent-primary"
              />
              Exclude dismissed users
            </label>
            <DateRangeFilter
              from={dateFrom}
              to={dateTo}
              onChangeFrom={setDateFrom}
              onChangeTo={setDateTo}
            />
            {/* One date entered means that one day, so the applied window is
                stated outright rather than inferred from a half-filled pair. */}
            {appliedRangeLabel && (
              <span className="text-sm text-muted-foreground">
                Showing{" "}
                <span className="font-medium text-foreground">
                  {appliedRangeLabel}
                </span>
              </span>
            )}
          </FilterBar>

          {/* Stats */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">Associates: </span>
                <span className="font-semibold text-foreground">
                  {stats.totalAssociates}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Sourced Deals: </span>
                <span className="font-semibold text-foreground">
                  {formatNumber(stats.totalDeals)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Presented Deals: </span>
                <span className="font-semibold text-foreground">
                  {formatNumber(stats.totalPresented)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Accepted: </span>
                <span className="font-semibold text-status-good">
                  {formatNumber(stats.totalAccepted)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Rejected: </span>
                <span className="font-semibold text-status-critical">
                  {formatNumber(stats.totalRejected)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">On Hold: </span>
                <span className="font-semibold text-status-serious">
                  {formatNumber(stats.totalOnHold)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Awaiting: </span>
                <span className="font-semibold text-status-warning">
                  {formatNumber(stats.totalAwaiting)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Total Clients: </span>
                <span className="font-semibold text-foreground">
                  {stats.totalClients}
                </span>
              </div>
            </div>
          </div>

          {/* Fed the same filtered rows the table below renders, so the board
              and the breakdown always tell the same story. */}
          <TeamLeaderboard rows={filteredData} isLoading={isLoading} />

          <InfoCard
            title="Presented Deals"
            subtitle="Deals grouped by associate and client. Accepted, rejected and on hold count presented deals by where they moved after Video Presentation; awaiting response counts those still sitting in it."
            contentClassName="p-0"
            actions={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isLoading || isExporting || sortedData.length === 0}
                  >
                    <Download className="h-3.5 w-3.5" />
                    {isExporting ? "Preparing…" : "Export"}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/* The rows the figures above were counted from, not the
                      figures themselves -- one tab per source. */}
                  <DropdownMenuLabel>Underlying rows</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={exportWorkbook}>
                    Excel workbook (both tabs)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={exportSourcedCsv}>
                    CSV — Sourced
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={exportPresentedCsv}>
                    CSV — Presented Deals
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          >
            {isLoading ? (
              <TableSkeleton rows={8} columns={COLUMNS.length} className="border-0 shadow-none" />
            ) : sortedData.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {search || dateFrom || dateTo || team !== "All" || excludeDismissed
                  ? "No presented deals match your filters."
                  : "No presented deals found."}
              </div>
            ) : (
              <div className="scrollbar-thin overflow-x-auto">
                <table className="w-50">
                  <thead>
                    <tr>
                      {HEADER_GROUPS.map(({ group, span, col }) =>
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
                            className={cn(
                              "table-th",
                              col.align === "right" && "text-right",
                            )}
                          >
                            <SortButton
                              column={col}
                              sort={sort}
                              onSort={toggleSort}
                            />
                          </th>
                        ),
                      )}
                    </tr>
                    <tr>
                      {GROUPED_COLUMNS.map((col) => (
                        <th
                          key={col.key}
                          className={cn(
                            "table-th",
                            col.align === "right" && "text-right",
                          )}
                        >
                          <SortButton
                            column={col}
                            sort={sort}
                            onSort={toggleSort}
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedData.map((associate) => {
                      const isExpanded = expandedAssociates.has(associate.name);
                      return (
                        <Fragment key={associate.name}>
                          {/* Associate Row */}
                          <tr
                            onClick={() => toggleAssociate(associate.name)}
                            className="transition-colors hover:bg-muted/40 cursor-pointer"
                          >
                            <td className="table-td font-medium text-foreground">
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                )}
                                <span className="truncate">{associate.name}</span>
                              </div>
                            </td>
                            <td className="table-td text-right font-semibold text-primary tabular-nums">
                              {formatNumber(associate.total)}
                            </td>
                            <td className="table-td text-right font-semibold text-foreground tabular-nums">
                              {formatNumber(associate.presented)}
                            </td>
                            <td className="table-td text-right font-semibold text-status-good tabular-nums">
                              {formatNumber(associate.accepted)}
                            </td>
                            <td className="table-td text-right font-semibold text-status-critical tabular-nums">
                              {formatNumber(associate.rejected)}
                            </td>
                            <td className="table-td text-right font-semibold text-status-serious tabular-nums">
                              {formatNumber(associate.onHold)}
                            </td>
                            <td className="table-td text-right font-semibold text-status-warning tabular-nums">
                              {formatNumber(associate.awaiting)}
                            </td>
                          </tr>

                          {/* Client Rows (expanded) */}
                          {isExpanded &&
                            associate.clients.map((client) => (
                              <tr
                                key={`client-${associate.name}-${client.clientName}`}
                                className="transition-colors hover:bg-muted/30"
                              >
                                <td className="table-td pl-10 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate">
                                      • {client.clientName}
                                    </span>
                                  </div>
                                </td>
                                <td className="table-td text-right text-sm font-medium text-foreground tabular-nums">
                                  {formatNumber(client.count)}
                                </td>
                                <td className="table-td text-right text-sm font-medium text-muted-foreground tabular-nums">
                                  {formatNumber(client.presented)}
                                </td>
                                <td className="table-td text-right text-sm font-medium text-status-good tabular-nums">
                                  {formatNumber(client.accepted)}
                                </td>
                                <td className="table-td text-right text-sm font-medium text-status-critical tabular-nums">
                                  {formatNumber(client.rejected)}
                                </td>
                                <td className="table-td text-right text-sm font-medium text-status-serious tabular-nums">
                                  {formatNumber(client.onHold)}
                                </td>
                                <td className="table-td text-right text-sm font-medium text-status-warning tabular-nums">
                                  {formatNumber(client.awaiting)}
                                </td>
                              </tr>
                            ))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </InfoCard>
        </div>
      )}
    </PageContainer>
  );
}
