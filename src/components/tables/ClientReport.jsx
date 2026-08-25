import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { InfoCard } from "@/components/cards/InfoCard";
import { TableSkeleton } from "@/components/common/LoadingSkeleton";
import {
  GroupedTableHead,
  METRICS,
  METRIC_CLASS,
  useSort,
  withMetricColumns,
} from "@/components/tables/presentedColumns";
import { StatusBadge } from "@/components/tables/StatusBadge";
import { getClientStatusVariant } from "@/utils/clientFields";
import { formatDateOnly, formatNumber } from "@/utils/format";
import { cn } from "@/utils/cn";

// Status and Deal Flow Start are the client's own Bitrix record rather than
// anything counted here, so they sit next to the name and ahead of the figures
// -- and they're the same two columns, read the same way, as the Clients page.
const COLUMNS = withMetricColumns(
  { key: "clientName", label: "Client / Associate" },
  { key: "status", label: "Status" },
  { key: "dealFlowStart", label: "Deal Flow Start" },
);

/**
 * Every client in the current view, with the same columns as the associate
 * table below it -- the report read by client rather than by associate.
 *
 * `rows` are the rolled-up client rows from buildClientReport. Expanding one
 * lists the associates who worked that client, so the two tables are each
 * other's inverse: an associate expands into its clients, a client into its
 * associates, and both sum to the same figures.
 *
 * Every client is listed, not a leading few -- this is the full record.
 */
export function ClientReport({ rows = [], isLoading, className }) {
  const [sort, toggleSort] = useSort("total");
  const [expanded, setExpanded] = useState(new Set());

  const sortedRows = useMemo(() => {
    const dir = sort.direction === "asc" ? 1 : -1;
    // Ties fall back to the name so re-sorting never reshuffles equal rows.
    const byName = (a, b) => a.clientName.localeCompare(b.clientName);

    return [...rows].sort((a, b) => {
      if (sort.field === "clientName") return byName(a, b) * dir;

      const [av, bv] = [a[sort.field], b[sort.field]];
      // Status and Deal Flow Start are both empty for a partner name that never
      // matched a Bitrix contact, and a null compares neither greater nor less
      // than a value -- without this those rows would sit wherever the previous
      // sort left them. Park them last in both directions instead.
      if (av == null || bv == null) {
        return av == bv ? byName(a, b) : av == null ? 1 : -1;
      }
      // Status alphabetically, Deal Flow Start by date -- the ISO strings the
      // roster stores compare correctly as plain strings either way.
      if (typeof av === "string") return av.localeCompare(bv) * dir || byName(a, b);
      return (av > bv ? 1 : av < bv ? -1 : 0) * dir || byName(a, b);
    });
  }, [rows, sort]);

  function toggleClient(clientName) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(clientName)) next.delete(clientName);
      else next.add(clientName);
      return next;
    });
  }

  return (
    <InfoCard
      title="Clients"
      subtitle="Every client in the current view, with the deals sourced for them and how their presented deals landed. Expand a client to see the associates behind its figures."
      contentClassName="p-0"
      className={className}
      actions={
        !isLoading && (
          <span className="text-sm text-muted-foreground">
            {formatNumber(rows.length)} client{rows.length === 1 ? "" : "s"}
          </span>
        )
      }
    >
      {isLoading ? (
        <TableSkeleton rows={8} columns={COLUMNS.length} className="border-0 shadow-none" />
      ) : sortedRows.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          No clients match your filters.
        </div>
      ) : (
        <div className="scrollbar-thin overflow-x-auto">
          {/* Shrink-to-fit rather than stretched, so this sits at the same
              width as the associate table it mirrors on Presented Deals. */}
          <table className="w-auto">
            <GroupedTableHead columns={COLUMNS} sort={sort} onSort={toggleSort} />
            <tbody>
              {sortedRows.map((client) => {
                const isExpanded = expanded.has(client.clientName);
                return (
                  <Fragment key={client.clientName}>
                    <tr
                      onClick={() => toggleClient(client.clientName)}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                    >
                      <td className="table-td font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          )}
                          <span className="truncate">{client.clientName}</span>
                        </div>
                      </td>
                      <td className="table-td">
                        {client.status ? (
                          <StatusBadge
                            status={client.status}
                            variant={getClientStatusVariant(client.status)}
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="table-td whitespace-nowrap text-muted-foreground">
                        {formatDateOnly(client.dealFlowStart)}
                      </td>
                      {METRICS.map((metric) => (
                        <td
                          key={metric}
                          className={cn(
                            "table-td text-right font-semibold tabular-nums",
                            METRIC_CLASS[metric],
                          )}
                        >
                          {formatNumber(client[metric])}
                        </td>
                      ))}
                    </tr>

                    {isExpanded &&
                      client.associates.map((associate) => (
                        <tr
                          key={`associate-${client.clientName}-${associate.name}`}
                          className="transition-colors hover:bg-muted/30"
                        >
                          <td className="table-td pl-10 text-sm text-muted-foreground">
                            <span className="truncate">• {associate.name}</span>
                          </td>
                          {/* Status and Deal Flow Start describe the client, not
                              the associates under it -- left blank rather than
                              repeated down every line of the breakdown. */}
                          <td className="table-td" />
                          <td className="table-td" />
                          {METRICS.map((metric) => (
                            <td
                              key={metric}
                              className={cn(
                                "table-td text-right text-sm font-medium tabular-nums",
                                // The client row leads with its sourced figure;
                                // the associates under it are a breakdown, so
                                // they stay recessive rather than repeating the
                                // accent on every line.
                                metric === "total"
                                  ? "text-foreground"
                                  : metric === "presented"
                                    ? "text-muted-foreground"
                                    : METRIC_CLASS[metric],
                              )}
                            >
                              {formatNumber(associate[metric])}
                            </td>
                          ))}
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
  );
}
