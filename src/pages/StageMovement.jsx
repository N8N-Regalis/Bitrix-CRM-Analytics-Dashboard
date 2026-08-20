import { useMemo, useState, useEffect } from 'react';
import { ArrowRightLeft, AlertTriangle, Timer, TrendingUp } from 'lucide-react';
import { fetchLastActivitiesForDeals } from '@/utils/bitrixActivity';
import { PageContainer } from '@/components/layout/PageContainer';
import { StatCard } from '@/components/cards/StatCard';
import { StageDurationChart } from '@/components/charts/StageDurationChart';
import { TopTransitionsTable } from '@/components/tables/TopTransitionsTable';
import { StalledDealsTable } from '@/components/tables/StalledDealsTable';
import { ActiveStalledDealsTable } from '@/components/tables/ActiveStalledDealsTable';
import { StageMovementsTable } from '@/components/tables/StageMovementsTable';
import { ValuationModelingReportTable } from '@/components/tables/ValuationModelingReportTable';
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';
import { ErrorState } from '@/components/common/ErrorState';
import { useDealsQuery } from '@/hooks/useDeals';
import {
  useStageDurationStats,
  useTopTransitions,
  useTotalMovementCount,
  useOpenStageRows,
  useRecentTransitions,
  useAllCompletedTransitions,
} from '@/hooks/useStageHistory';
import {
  getStageDurationChartData,
  getOverallAvgDurationDays,
  getMostCommonTransition,
  getDisplayTransitions,
  getStalledDeals,
  countStalledDeals,
  getActiveStalledDeals,
  countActiveStalledDeals,
  getValuationModelingByAssociate,
} from '@/services/stageAnalyticsService';
import { formatNumber, formatDuration } from '@/utils/format';

const STALLED_CUTOFF_DAYS = 14;

export default function StageMovement() {
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [activityDates, setActivityDates] = useState(null);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);

  const dealsQuery = useDealsQuery();
  const durationStatsQuery = useStageDurationStats();
  const topTransitionsQuery = useTopTransitions(15);
  const totalMovementQuery = useTotalMovementCount();
  const openStageQuery = useOpenStageRows();
  const recentTransitionsQuery = useRecentTransitions(page);
  const allTransitionsQuery = useAllCompletedTransitions();

  const deals = dealsQuery.data ?? [];
  const dealsById = useMemo(() => new Map(deals.map((d) => [d.id, d])), [deals]);

  const durationStats = durationStatsQuery.data ?? [];
  const topTransitions = useMemo(
    () => getDisplayTransitions(topTransitionsQuery.data ?? []),
    [topTransitionsQuery.data],
  );
  const openRows = openStageQuery.data ?? [];
  const recent = recentTransitionsQuery.data ?? { rows: [], total: 0, page: 1, pageSize: 20 };

  const durationChartData = useMemo(() => getStageDurationChartData(durationStats), [durationStats]);
  const overallAvgDays = useMemo(() => getOverallAvgDurationDays(durationStats), [durationStats]);
  const mostCommonMove = useMemo(() => getMostCommonTransition(topTransitions), [topTransitions]);
  const stalledDeals = useMemo(() => getStalledDeals(openRows, dealsById, Number.MAX_SAFE_INTEGER), [openRows, dealsById]);
  const stalledCount = useMemo(
    () => countStalledDeals(openRows, dealsById, STALLED_CUTOFF_DAYS),
    [openRows, dealsById],
  );
  const activeStalledDeals = useMemo(() => getActiveStalledDeals(openRows, dealsById, Number.MAX_SAFE_INTEGER), [openRows, dealsById]);
  const activeStalledCount = useMemo(
    () => countActiveStalledDeals(openRows, dealsById, STALLED_CUTOFF_DAYS),
    [openRows, dealsById],
  );
  const valuationModelingReport = useMemo(
    () => getValuationModelingByAssociate(allTransitionsQuery.data ?? [], openRows, dealsById, 'FINANCIAL_MODEL', 'MODEL_REVIEW', 'LOSE', dateFrom, dateTo),
    [allTransitionsQuery.data, openRows, dealsById, dateFrom, dateTo],
  );

  // Fetch activity dates for both stalled and active stalled deals when they change
  useEffect(() => {
    const allStalledDealIds = [...new Set([...stalledDeals.map(d => d.dealId), ...activeStalledDeals.map(d => d.dealId)])];
    if (allStalledDealIds.length === 0) {
      setActivityDates(null);
      return;
    }
    
    setIsLoadingActivities(true);
    fetchLastActivitiesForDeals(allStalledDealIds)
      .then(setActivityDates)
      .catch(error => {
        console.error('Failed to fetch activity dates:', error);
        setActivityDates(null);
      })
      .finally(() => setIsLoadingActivities(false));
  }, [stalledDeals, activeStalledDeals]);

  // Re-calculate stalled deals with activity dates when they're available
  const stalledDealsWithActivity = useMemo(() => 
    getStalledDeals(openRows, dealsById, Number.MAX_SAFE_INTEGER, activityDates), 
    [openRows, dealsById, activityDates]
  );
  
  const activeStalledDealsWithActivity = useMemo(() => 
    getActiveStalledDeals(openRows, dealsById, Number.MAX_SAFE_INTEGER, activityDates), 
    [openRows, dealsById, activityDates]
  );

  const isLoading =
    dealsQuery.isLoading ||
    durationStatsQuery.isLoading ||
    topTransitionsQuery.isLoading ||
    totalMovementQuery.isLoading ||
    openStageQuery.isLoading ||
    recentTransitionsQuery.isLoading ||
    allTransitionsQuery.isLoading ||
    isLoadingActivities;

  const isError =
    dealsQuery.isError ||
    durationStatsQuery.isError ||
    topTransitionsQuery.isError ||
    totalMovementQuery.isError ||
    openStageQuery.isError ||
    recentTransitionsQuery.isError ||
    allTransitionsQuery.isError;

  const error =
    dealsQuery.error ||
    durationStatsQuery.error ||
    topTransitionsQuery.error ||
    totalMovementQuery.error ||
    openStageQuery.error ||
    recentTransitionsQuery.error ||
    allTransitionsQuery.error;

  function refetchAll() {
    dealsQuery.refetch();
    durationStatsQuery.refetch();
    topTransitionsQuery.refetch();
    totalMovementQuery.refetch();
    openStageQuery.refetch();
    recentTransitionsQuery.refetch();
    allTransitionsQuery.refetch();
  }

  const totalPages = Math.max(1, Math.ceil((recent.total || 0) / (recent.pageSize || 20)));

  return (
    <PageContainer
      title="Stage Movement"
      subtitle="How deals flow between pipeline stages over time"
      isLoading={isLoading}
    >
      {isError ? (
        <ErrorState message={error?.message} onRetry={refetchAll} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <StatCard
              label="Total Movements Tracked"
              value={formatNumber(totalMovementQuery.data)}
              icon={ArrowRightLeft}
              color="primary"
              description="Completed stage-to-stage moves recorded since sync began"
              isLoading={totalMovementQuery.isLoading}
            />
            <StatCard
              label={`Stalled ${STALLED_CUTOFF_DAYS}+ Days`}
              value={formatNumber(stalledCount)}
              icon={AlertTriangle}
              color="warning"
              description="Deals that have sat in their current stage for two weeks or more"
              isLoading={openStageQuery.isLoading || dealsQuery.isLoading}
            />
            <StatCard
              label={`Active Stalled ${STALLED_CUTOFF_DAYS}+ Days`}
              value={formatNumber(activeStalledCount)}
              icon={AlertTriangle}
              color="success"
              description="Active pipeline deals stalled 14+ days"
              isLoading={openStageQuery.isLoading || dealsQuery.isLoading}
            />
            <StatCard
              label="Avg Time in Stage"
              value={formatDuration(overallAvgDays)}
              icon={Timer}
              color="indigo"
              description="Weighted average time deals spend in a stage before moving on"
              isLoading={durationStatsQuery.isLoading}
            />
            <StatCard
              label="Most Common Move"
              value={mostCommonMove ? `${mostCommonMove.fromLabel} → ${mostCommonMove.toLabel}` : '—'}
              sub={mostCommonMove ? `${formatNumber(mostCommonMove.count)} deals` : undefined}
              icon={TrendingUp}
              color="purple"
              description="The single most frequent stage-to-stage transition"
              isLoading={topTransitionsQuery.isLoading}
            />
          </div>

          <StageDurationChart data={durationChartData} isLoading={durationStatsQuery.isLoading} />

          <TopTransitionsTable transitions={topTransitions} isLoading={topTransitionsQuery.isLoading} />

          <StalledDealsTable deals={stalledDealsWithActivity} isLoading={openStageQuery.isLoading || dealsQuery.isLoading || isLoadingActivities} />

          <ActiveStalledDealsTable deals={activeStalledDealsWithActivity} isLoading={openStageQuery.isLoading || dealsQuery.isLoading || isLoadingActivities} />

          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <h2 className="text-lg font-semibold">Valuation Modeling Report</h2>
              <DateRangeFilter
                from={dateFrom}
                to={dateTo}
                onChangeFrom={setDateFrom}
                onChangeTo={setDateTo}
              />
            </div>
            <ValuationModelingReportTable
              data={valuationModelingReport}
              isLoading={allTransitionsQuery.isLoading || openStageQuery.isLoading || dealsQuery.isLoading}
            />
          </div>

          <StageMovementsTable
            rows={recent.rows}
            dealsById={dealsById}
            isLoading={recentTransitionsQuery.isLoading}
            page={recent.page}
            totalPages={totalPages}
            onPageChange={setPage}
            total={recent.total}
            pageSize={recent.pageSize}
          />
        </div>
      )}
    </PageContainer>
  );
}
