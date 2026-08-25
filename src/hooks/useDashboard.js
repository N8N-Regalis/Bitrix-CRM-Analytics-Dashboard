import { useMemo, useState } from 'react';
import { useDealsQuery } from '@/hooks/useDeals';
import {
  getKpis,
  getDealsPerMonth,
  getDealsPerDay,
  getStageDistribution,
  getAssociatePerformance,
  getRecentDeals,
  countDaysInRange,
} from '@/services/dashboardService';
import { inDateRange, resolveDateRange } from '@/utils/dateRange';

const EMPTY_DEALS = [];

/** Days shown by the per-day chart when no range is applied. */
const DEFAULT_PER_DAY_SPAN = 30;

/**
 * Past this many days the per-day chart stops being readable: it renders one
 * 64px bar per day inside a horizontal scroller, so a year of range is ~23,000px
 * of scrolling to cross. Longer ranges are left to the monthly trend chart,
 * which covers the same rows at a granularity that fits the card.
 */
const MAX_PER_DAY_SPAN = 60;

export function useDashboard() {
  const query = useDealsQuery();
  const deals = query.data ?? EMPTY_DEALS;

  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);

  // Half-typed dates are held back and one date entered means that one day, so
  // what gets counted is not always the pair in the inputs -- hence appliedRange
  // below, which the page states outright rather than leaving to be inferred.
  const { dateFrom: appliedFrom, dateTo: appliedTo } = resolveDateRange(dateFrom, dateTo);

  // Filters on created date, so every block below reads as "deals created in
  // this window, and where they stand now" -- a deal closed inside the range but
  // created before it is out. Same basis as the Associates and Clients pages.
  const filteredDeals = useMemo(() => {
    if (!appliedFrom && !appliedTo) return deals;
    return deals.filter((d) => inDateRange(d.createdDay, appliedFrom, appliedTo));
  }, [deals, appliedFrom, appliedTo]);

  // The trend charts span the applied range instead of their usual trailing
  // window. Left fixed, they would show mostly-empty months and days beside KPI
  // cards reporting real numbers -- and go blank entirely for any range older
  // than the window, which reads as a broken page rather than a filtered one.
  const chartWindow = useMemo(
    () => ({ dateFrom: appliedFrom, dateTo: appliedTo }),
    [appliedFrom, appliedTo]
  );

  const perDaySpan = appliedFrom
    ? countDaysInRange(appliedFrom, appliedTo)
    : DEFAULT_PER_DAY_SPAN;
  const isPerDayTooWide = perDaySpan > MAX_PER_DAY_SPAN;

  const kpis = useMemo(() => getKpis(filteredDeals), [filteredDeals]);
  const dealsPerMonth = useMemo(
    () => getDealsPerMonth(filteredDeals, chartWindow),
    [filteredDeals, chartWindow]
  );
  // null rather than an oversized series: the page swaps in a note explaining
  // where those days went instead of rendering a chart nobody can scan.
  const dealsPerDay = useMemo(
    () =>
      isPerDayTooWide
        ? null
        : getDealsPerDay(filteredDeals, { ...chartWindow, daysBack: DEFAULT_PER_DAY_SPAN }),
    [filteredDeals, chartWindow, isPerDayTooWide]
  );
  // Closed/Axed are already covered by the KPI cards; mixing them into the stage
  // chart lets thousands of finished deals swamp the live pipeline view.
  const activeDeals = useMemo(
    () => filteredDeals.filter((d) => d.status === 'Active'),
    [filteredDeals]
  );
  const stageDistribution = useMemo(() => getStageDistribution(activeDeals), [activeDeals]);
  const associatePerformance = useMemo(
    () => getAssociatePerformance(filteredDeals, 8),
    [filteredDeals]
  );
  const recentDeals = useMemo(() => getRecentDeals(filteredDeals, 8), [filteredDeals]);

  function resetFilters() {
    setDateFrom(null);
    setDateTo(null);
  }

  return {
    kpis,
    dealsPerMonth,
    dealsPerDay,
    perDaySpan,
    maxPerDaySpan: MAX_PER_DAY_SPAN,
    stageDistribution,
    associatePerformance,
    recentDeals,
    filters: { dateFrom, dateTo },
    setDateFrom,
    setDateTo,
    resetFilters,
    hasActiveFilters: dateFrom !== null || dateTo !== null,
    // The window the figures were actually counted over -- see resolveDateRange.
    appliedRange: { dateFrom: appliedFrom, dateTo: appliedTo },
    isRangeApplied: Boolean(appliedFrom),
    hasData: filteredDeals.length > 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
