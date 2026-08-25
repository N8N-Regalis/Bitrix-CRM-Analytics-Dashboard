import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAllDeals } from '@/services/dealService';
import { inDateRange, resolveDateRange } from '@/utils/dateRange';

/** Shared base query — cached once and reused by every page that needs deals. */
export function useDealsQuery() {
  return useQuery({
    queryKey: ['deals'],
    queryFn: fetchAllDeals,
    staleTime: 5 * 60 * 1000,
  });
}

const DEFAULT_FILTERS = {
  search: '',
  stageId: 'All',
  ownerId: 'All',
  status: 'All',
  contactId: 'All',
  dateFrom: null,
  dateTo: null,
};

const PAGE_SIZE = 20;
const EMPTY_DEALS = [];

function compareValues(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === 'string') return a.localeCompare(b);
  return a > b ? 1 : -1;
}

/**
 * Deals table state: client-side search/filter/sort/pagination over the
 * shared cached dataset. With ~10k lightweight rows this is faster and
 * simpler than round-tripping every interaction to Supabase.
 */
export function useDeals(initialFilters) {
  const query = useDealsQuery();
  const deals = query.data ?? EMPTY_DEALS;

  const [filters, setFilters] = useState(() => ({ ...DEFAULT_FILTERS, ...initialFilters }));
  const [sort, setSort] = useState({ field: 'createdAt', direction: 'desc' });
  const [page, setPage] = useState(1);

  // The window actually queried, which is not always the pair in the inputs:
  // half-typed dates are held back, and one date entered means that one day.
  // The page states the result rather than leaving it to be inferred.
  const { dateFrom, dateTo } = resolveDateRange(filters.dateFrom, filters.dateTo);

  const filteredDeals = useMemo(() => {
    let result = deals;

    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      result = result.filter((d) => d.title.toLowerCase().includes(q) || String(d.id).includes(q));
    }
    if (filters.stageId !== 'All') {
      result = result.filter((d) => d.stageId === filters.stageId);
    }
    if (filters.ownerId !== 'All') {
      result = result.filter((d) => String(d.ownerId) === String(filters.ownerId));
    }
    if (filters.contactId !== 'All') {
      result = result.filter((d) => String(d.contactId) === String(filters.contactId));
    }
    if (filters.status !== 'All') {
      result = result.filter((d) => d.status === filters.status);
    }
    if (dateFrom || dateTo) {
      result = result.filter((d) => inDateRange(d.createdDay, dateFrom, dateTo));
    }

    const direction = sort.direction === 'asc' ? 1 : -1;
    return [...result].sort((a, b) => compareValues(a[sort.field], b[sort.field]) * direction);
  }, [deals, filters, dateFrom, dateTo, sort]);

  const total = filteredDeals.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pagedDeals = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredDeals.slice(start, start + PAGE_SIZE);
  }, [filteredDeals, currentPage]);

  function updateFilters(patch) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }

  function toggleSort(field) {
    setSort((prev) =>
      prev.field === field
        ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { field, direction: 'asc' }
    );
  }

  return {
    deals: pagedDeals,
    totalFiltered: total,
    totalAll: deals.length,
    page: currentPage,
    setPage,
    pageSize: PAGE_SIZE,
    totalPages,
    filters,
    // The range the rows were actually filtered by -- see resolveDateRange above.
    appliedRange: { dateFrom, dateTo },
    updateFilters,
    resetFilters,
    sort,
    toggleSort,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
