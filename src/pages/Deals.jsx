import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { FilterBar } from '@/components/filters/FilterBar';
import { StageFilter } from '@/components/filters/StageFilter';
import { AssociateFilter } from '@/components/filters/AssociateFilter';
import { ClientFilter } from '@/components/filters/ClientFilter';
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';
import { DealsTable } from '@/components/tables/DealsTable';
import { ErrorState } from '@/components/common/ErrorState';
import { useDeals, useDealsQuery } from '@/hooks/useDeals';

const STATUS_OPTIONS = ['All', 'Active', 'Won', 'Lost'];

export default function Deals() {
  const { data: allDeals = [] } = useDealsQuery();
  const [searchParams] = useSearchParams();
  const searchQueryParam = searchParams.get('q');
  const ownerParam = searchParams.get('owner');
  const {
    deals,
    filters,
    updateFilters,
    resetFilters,
    sort,
    toggleSort,
    page,
    setPage,
    totalPages,
    totalFiltered,
    pageSize,
    isLoading,
    isError,
    error,
    refetch,
  } = useDeals({ search: searchQueryParam ?? '', ownerId: ownerParam ?? 'All' });

  // The Deals page doesn't remount on same-route navigation, so header-search
  // links (e.g. /deals?q=...) only take effect via this explicit re-sync.
  useEffect(() => {
    if (searchQueryParam !== null || ownerParam !== null) {
      updateFilters({ search: searchQueryParam ?? '', ownerId: ownerParam ?? 'All' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQueryParam, ownerParam]);

  const stageOptions = useMemo(() => {
    const seen = new Map();
    for (const deal of allDeals) {
      if (!seen.has(deal.stageId)) seen.set(deal.stageId, deal.stageLabel);
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [allDeals]);

  const associateOptions = useMemo(() => {
    const seen = new Map();
    for (const deal of allDeals) {
      if (deal.ownerId !== null && !seen.has(deal.ownerId)) seen.set(deal.ownerId, deal.ownerLabel);
    }
    return [...seen.entries()]
      .map(([value, label]) => ({ value: String(value), label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allDeals]);

  const clientOptions = useMemo(() => {
    const seen = new Map();
    for (const deal of allDeals) {
      if (deal.contactId !== null && !seen.has(deal.contactId)) seen.set(deal.contactId, deal.clientLabel);
    }
    return [...seen.entries()]
      .map(([value, label]) => ({ value: String(value), label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allDeals]);

  const hasActiveFilters =
    filters.search !== '' ||
    filters.stageId !== 'All' ||
    filters.ownerId !== 'All' ||
    filters.contactId !== 'All' ||
    filters.status !== 'All' ||
    filters.dateFrom !== null ||
    filters.dateTo !== null;

  return (
    <PageContainer title="Deals" subtitle="Browse and filter every deal synced from Bitrix24">
      {isError ? (
        <ErrorState message={error?.message} onRetry={refetch} />
      ) : (
        <div className="space-y-4">
          <FilterBar onReset={resetFilters} hasActiveFilters={hasActiveFilters}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={filters.search}
                onChange={(e) => updateFilters({ search: e.target.value })}
                type="search"
                placeholder="Search deal name or ID..."
                className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-56"
              />
            </div>
            <StageFilter value={filters.stageId} onChange={(v) => updateFilters({ stageId: v })} options={stageOptions} />
            <AssociateFilter value={filters.ownerId} onChange={(v) => updateFilters({ ownerId: v })} options={associateOptions} />
            <ClientFilter value={filters.contactId} onChange={(v) => updateFilters({ contactId: v })} options={clientOptions} />
            <div className="flex items-center rounded-lg border border-border p-0.5">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => updateFilters({ status })}
                  className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                    filters.status === status ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
            <DateRangeFilter
              from={filters.dateFrom}
              to={filters.dateTo}
              onChangeFrom={(v) => updateFilters({ dateFrom: v })}
              onChangeTo={(v) => updateFilters({ dateTo: v })}
            />
          </FilterBar>

          <DealsTable
            deals={deals}
            isLoading={isLoading}
            sort={sort}
            onSort={toggleSort}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalFiltered={totalFiltered}
            pageSize={pageSize}
          />
        </div>
      )}
    </PageContainer>
  );
}
