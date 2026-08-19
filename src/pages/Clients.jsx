import { useMemo, useState } from "react";
import {
  Contact2,
  Briefcase,
  Trophy,
  Handshake,
  UserCheck,
  UserX,
  Search,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { StatCard } from "@/components/cards/StatCard";
import { InfoCard } from "@/components/cards/InfoCard";
import { ClientPerformanceChart } from "@/components/charts/ClientPerformanceChart";
import { ClientStatusChart } from "@/components/charts/ClientStatusChart";
import { FilterBar } from "@/components/filters/FilterBar";
import { DateRangeFilter } from "@/components/filters/DateRangeFilter";
import { ClientStatusFilter } from "@/components/filters/ClientStatusFilter";
import { ErrorState } from "@/components/common/ErrorState";
import { TableSkeleton } from "@/components/common/LoadingSkeleton";
import { StatusBadge } from "@/components/tables/StatusBadge";
import { useDealsQuery } from "@/hooks/useDeals";
import {
  getClientPerformance,
  getClientStatusDistribution,
} from "@/services/dashboardService";
import {
  getClientStatusVariant,
  ACTIVE_CLIENT_STATUS,
  OFFBOARDED_STATUSES,
  CLIENT_STATUS_ORDER,
} from "@/utils/clientFields";
import { formatPercent, formatNumber } from "@/utils/format";
import { cn } from "@/utils/cn";

const COLUMNS = [
  { key: "client", label: "Client" },
  { key: "status", label: "Status" },
  { key: "total", label: "Total Deals", align: "right" },
  { key: "won", label: "Won", align: "right" },
  { key: "active", label: "Active", align: "right" },
  { key: "lost", label: "Lost", align: "right" },
  { key: "winRate", label: "Win Rate", align: "right" },
  { key: "axedRate", label: "Axed Rate", align: "right" },
];

function SortIcon({ active, direction }) {
  if (!active)
    return <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />;
  return direction === "asc" ? (
    <ArrowUp className="h-3 w-3" />
  ) : (
    <ArrowDown className="h-3 w-3" />
  );
}

export default function Clients() {
  const {
    data: deals = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useDealsQuery();
  const [sort, setSort] = useState({ field: "total", direction: "desc" });
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");

  const filteredDeals = useMemo(() => {
    let result = deals;
    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter((d) => new Date(d.createdAt) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      result = result.filter((d) => new Date(d.createdAt) <= to);
    }
    return result;
  }, [deals, dateFrom, dateTo]);

  const hasActiveFilters =
    dateFrom !== null ||
    dateTo !== null ||
    search !== "" ||
    statusFilter !== "All";

  function resetFilters() {
    setDateFrom(null);
    setDateTo(null);
    setSearch("");
    setStatusFilter("All");
  }

  // Client roster grows fast (unlike the associate roster), so the table
  // below is searchable. No cap: getClientPerformance also seeds zero-deal
  // rows for every known Bitrix contact (e.g. still "Setting Up"), so client
  // count can exceed deal count — the old "cap at deal count" no-op doesn't
  // hold anymore.
  const allClientsUnfiltered = useMemo(
    () => getClientPerformance(filteredDeals, Infinity),
    [filteredDeals],
  );

  // Options are derived from the unfiltered set (not `allClients` below) so
  // picking a status doesn't collapse the dropdown to just that one option.
  // Ordered by the client lifecycle funnel, same as the distribution chart,
  // not alphabetically — order carries meaning here.
  const statusOptions = useMemo(() => {
    const present = new Set(allClientsUnfiltered.map((c) => c.status));
    const ordered = CLIENT_STATUS_ORDER.filter((status) => present.has(status));
    const unknown = [...present].filter(
      (status) => !CLIENT_STATUS_ORDER.includes(status),
    );
    return [...ordered, ...unknown].map((status) => ({
      value: status,
      label: status,
    }));
  }, [allClientsUnfiltered]);

  const allClients = useMemo(() => {
    if (statusFilter === "All") return allClientsUnfiltered;
    return allClientsUnfiltered.filter((c) => c.status === statusFilter);
  }, [allClientsUnfiltered, statusFilter]);

  const topClients = useMemo(() => allClients.slice(0, 8), [allClients]);

  // The "All Clients" table only lists clients with at least one deal in
  // Bitrix — the KPIs/chart/filter above stay scoped to the full roster
  // (including zero-deal contacts like "Setting Up"), but the table itself
  // is deal-outcome focused (Total/Won/Active/Lost/Win Rate), which reads as
  // empty noise for contacts that have never had a deal.
  const clientsWithDeals = useMemo(
    () => allClients.filter((c) => c.total > 0),
    [allClients],
  );

  const searchedClients = useMemo(() => {
    if (!search.trim()) return clientsWithDeals;
    const q = search.trim().toLowerCase();
    return clientsWithDeals.filter((row) =>
      row.client.toLowerCase().includes(q),
    );
  }, [clientsWithDeals, search]);

  const sortedClients = useMemo(() => {
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...searchedClients].sort((a, b) => {
      const [av, bv] = [a[sort.field], b[sort.field]];
      return (av > bv ? 1 : av < bv ? -1 : 0) * dir;
    });
  }, [searchedClients, sort]);

  function toggleSort(field) {
    setSort((prev) =>
      prev.field === field
        ? { field, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { field, direction: "desc" },
    );
  }

  const topClient = allClients[0];
  const avgDealsPerClient = allClients.length
    ? filteredDeals.length / allClients.length
    : 0;
  const activeClientsCount = useMemo(
    () => allClients.filter((c) => c.status === ACTIVE_CLIENT_STATUS).length,
    [allClients],
  );
  const offboardedClientsCount = useMemo(
    () =>
      allClients.filter((c) => OFFBOARDED_STATUSES.includes(c.status)).length,
    [allClients],
  );
  const clientStatusDistribution = useMemo(
    () => getClientStatusDistribution(allClients),
    [allClients],
  );

  return (
    <PageContainer
      title="Clients"
      subtitle="Deal volume and outcomes by client contact"
    >
      {isError ? (
        <ErrorState message={error?.message} onRetry={refetch} />
      ) : (
        <div className="space-y-6">
          <FilterBar onReset={resetFilters} hasActiveFilters={hasActiveFilters}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                type="search"
                placeholder="Search client name..."
                className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-56"
              />
            </div>
            <ClientStatusFilter
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
            />
            <DateRangeFilter
              from={dateFrom}
              to={dateTo}
              onChangeFrom={setDateFrom}
              onChangeTo={setDateTo}
            />
          </FilterBar>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label="Total Clients"
              value={formatNumber(allClients.length)}
              icon={Contact2}
              color="primary"
              description="Every known Bitrix client contact, including those with no deal yet"
              isLoading={isLoading}
            />
            <StatCard
              label="Total Clients with Deals"
              value={formatNumber(clientsWithDeals.length)}
              icon={Briefcase}
              color="purple"
              description="Clients with at least one deal added in Bitrix"
              isLoading={isLoading}
            />
            <StatCard
              label="Active Clients"
              value={formatNumber(activeClientsCount)}
              icon={UserCheck}
              color="primary"
              description={`Clients with status "${ACTIVE_CLIENT_STATUS}"`}
              isLoading={isLoading}
            />
            <StatCard
              label="Offboarded Clients"
              value={formatNumber(offboardedClientsCount)}
              icon={UserX}
              color="critical"
              description={`Clients with status ${OFFBOARDED_STATUSES.map((s) => `"${s}"`).join(", ")}`}
              isLoading={isLoading}
            />
            <StatCard
              label="Top by Volume"
              value={topClient?.client ?? "—"}
              sub={
                topClient ? `${formatNumber(topClient.total)} deals` : undefined
              }
              icon={Trophy}
              color="indigo"
              description="Client contact with the most deals created"
              isLoading={isLoading}
            />
            <StatCard
              label="Avg Deals / Client"
              value={avgDealsPerClient.toFixed(1)}
              icon={Handshake}
              color="good"
              description="Total deals divided by distinct client contacts"
              isLoading={isLoading}
            />
          </div>

          <ClientStatusChart
            data={clientStatusDistribution}
            isLoading={isLoading}
          />
          <ClientPerformanceChart data={topClients} isLoading={isLoading} />
          <InfoCard
            title="All Clients"
            subtitle="Every client contact with at least one deal added in Bitrix"
            contentClassName="p-0"
          >
            {isLoading ? (
              <TableSkeleton
                rows={8}
                columns={8}
                className="border-0 shadow-none"
              />
            ) : (
              <div className="scrollbar-thin overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      {COLUMNS.map((col) => (
                        <th
                          key={col.key}
                          className={cn(
                            "table-th",
                            col.align === "right" && "text-right",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSort(col.key)}
                            className={cn(
                              "inline-flex items-center gap-1 transition-colors hover:text-foreground",
                              col.align === "right" && "flex-row-reverse",
                            )}
                          >
                            {col.label}
                            <SortIcon
                              active={sort.field === col.key}
                              direction={sort.direction}
                            />
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedClients.map((row) => (
                      <tr
                        key={row.contactId ?? "none"}
                        className="transition-colors hover:bg-muted/40"
                      >
                        <td className="table-td font-medium text-foreground">
                          {row.client}
                        </td>
                        <td className="table-td">
                          <StatusBadge
                            status={row.status}
                            variant={getClientStatusVariant(row.status)}
                          />
                        </td>
                        <td className="table-td text-right tabular-nums">
                          {formatNumber(row.total)}
                        </td>
                        <td className="table-td text-right tabular-nums text-status-good">
                          {formatNumber(row.won)}
                        </td>
                        <td className="table-td text-right tabular-nums text-primary">
                          {formatNumber(row.active)}
                        </td>
                        <td className="table-td text-right tabular-nums text-status-critical">
                          {formatNumber(row.lost)}
                        </td>
                        <td className="table-td text-right tabular-nums">
                          {formatPercent(row.winRate)}
                        </td>
                        <td className="table-td text-right tabular-nums text-status-critical">
                          {formatPercent(row.axedRate)}
                        </td>
                      </tr>
                    ))}
                    {sortedClients.length === 0 && (
                      <tr>
                        <td
                          colSpan={COLUMNS.length}
                          className="table-td py-8 text-center text-muted-foreground"
                        >
                          No clients match your filters.
                        </td>
                      </tr>
                    )}
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
