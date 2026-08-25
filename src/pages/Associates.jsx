import { useMemo, useState } from 'react';
import { Users, Trophy, TrendingUp, ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { StatCard } from '@/components/cards/StatCard';
import { InfoCard } from '@/components/cards/InfoCard';
import { AssociatePerformanceChart } from '@/components/charts/AssociatePerformanceChart';
import { FilterBar } from '@/components/filters/FilterBar';
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';
import { ErrorState } from '@/components/common/ErrorState';
import { TableSkeleton } from '@/components/common/LoadingSkeleton';
import { useDealsQuery } from '@/hooks/useDeals';
import { getAssociatePerformance } from '@/services/dashboardService';
import { formatPercent, formatNumber } from '@/utils/format';
import { describeRange, inDateRange, resolveDateRange } from '@/utils/dateRange';
import { cn } from '@/utils/cn';

const COLUMNS = [
  { key: 'associate', label: 'Associate' },
  { key: 'total', label: 'Total Deals', align: 'right' },
  { key: 'won', label: 'Closed', align: 'right' },
  { key: 'active', label: 'Active', align: 'right' },
  { key: 'lost', label: 'Axed', align: 'right' },
  { key: 'winRate', label: 'Close Rate', align: 'right' },
  { key: 'axedRate', label: 'Axed Rate', align: 'right' },
];

function SortIcon({ active, direction }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />;
  return direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

export default function Associates() {
  const { data: deals = [], isLoading, isError, error, refetch } = useDealsQuery();
  const [sort, setSort] = useState({ field: 'total', direction: 'desc' });
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);

  // Half-typed dates are held back and one date entered means that one day, so
  // what gets queried is not always the pair in the inputs -- hence the label.
  const appliedRange = resolveDateRange(dateFrom, dateTo);
  const appliedFrom = appliedRange.dateFrom;
  const appliedTo = appliedRange.dateTo;
  const appliedRangeLabel = describeRange(appliedFrom, appliedTo);

  const filteredDeals = useMemo(() => {
    if (!appliedFrom && !appliedTo) return deals;
    return deals.filter((d) => inDateRange(d.createdDay, appliedFrom, appliedTo));
  }, [deals, appliedFrom, appliedTo]);

  const hasActiveFilters = dateFrom !== null || dateTo !== null;

  function resetFilters() {
    setDateFrom(null);
    setDateTo(null);
  }

  const allAssociates = useMemo(
    () => getAssociatePerformance(filteredDeals, filteredDeals.length || 1),
    [filteredDeals]
  );
  const topAssociates = useMemo(() => allAssociates.slice(0, 8), [allAssociates]);

  const sortedAssociates = useMemo(() => {
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...allAssociates].sort((a, b) => {
      const [av, bv] = [a[sort.field], b[sort.field]];
      return (av > bv ? 1 : av < bv ? -1 : 0) * dir;
    });
  }, [allAssociates, sort]);

  function toggleSort(field) {
    setSort((prev) =>
      prev.field === field ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { field, direction: 'desc' }
    );
  }

  const topPerformer = allAssociates[0];
  const avgWinRate = allAssociates.length
    ? allAssociates.reduce((sum, a) => sum + a.winRate, 0) / allAssociates.length
    : 0;

  return (
    <PageContainer
      title="Associates"
      subtitle="Performance and workload by team member"
      isLoading={isLoading}
    >
      {isError ? (
        <ErrorState message={error?.message} onRetry={refetch} />
      ) : (
        <div className="space-y-6">
          <FilterBar onReset={resetFilters} hasActiveFilters={hasActiveFilters}>
            <DateRangeFilter from={dateFrom} to={dateTo} onChangeFrom={setDateFrom} onChangeTo={setDateTo} />
            {appliedRangeLabel && (
              <span className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">{appliedRangeLabel}</span>
              </span>
            )}
          </FilterBar>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Total Associates"
              value={formatNumber(allAssociates.length)}
              icon={Users}
              color="primary"
              description="Associates with at least one assigned deal"
              isLoading={isLoading}
            />
            <StatCard
              label="Top by Volume"
              value={topPerformer?.associate ?? '—'}
              sub={topPerformer ? `${formatNumber(topPerformer.total)} deals` : undefined}
              icon={Trophy}
              color="indigo"
              description="Associate with the most assigned deals"
              isLoading={isLoading}
            />
            <StatCard
              label="Avg Close Rate"
              value={formatPercent(avgWinRate)}
              icon={TrendingUp}
              color="good"
              description="Average close rate across finished deals, per associate"
              isLoading={isLoading}
            />
          </div>

          <AssociatePerformanceChart data={topAssociates} isLoading={isLoading} />

          <InfoCard title="All Associates" subtitle="Every associate with at least one deal" contentClassName="p-0">
            {isLoading ? (
              <TableSkeleton rows={8} columns={7} className="border-0 shadow-none" />
            ) : (
              <div className="scrollbar-thin overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      {COLUMNS.map((col) => (
                        <th key={col.key} className={cn('table-th', col.align === 'right' && 'text-right')}>
                          <button
                            type="button"
                            onClick={() => toggleSort(col.key)}
                            className={cn(
                              'inline-flex items-center gap-1 transition-colors hover:text-foreground',
                              col.align === 'right' && 'flex-row-reverse'
                            )}
                          >
                            {col.label}
                            <SortIcon active={sort.field === col.key} direction={sort.direction} />
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAssociates.map((row) => (
                      <tr key={row.ownerId ?? 'unassigned'} className="transition-colors hover:bg-muted/40">
                        <td className="table-td font-medium text-foreground">{row.associate}</td>
                        <td className="table-td text-right tabular-nums">{formatNumber(row.total)}</td>
                        <td className="table-td text-right tabular-nums text-status-good">{formatNumber(row.won)}</td>
                        <td className="table-td text-right tabular-nums text-primary">{formatNumber(row.active)}</td>
                        <td className="table-td text-right tabular-nums text-status-critical">{formatNumber(row.lost)}</td>
                        <td className="table-td text-right tabular-nums">{formatPercent(row.winRate)}</td>
                        <td className="table-td text-right tabular-nums text-status-critical">{formatPercent(row.axedRate)}</td>
                      </tr>
                    ))}
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
