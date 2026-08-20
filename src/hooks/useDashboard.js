import { useMemo } from 'react';
import { useDealsQuery } from '@/hooks/useDeals';
import {
  getKpis,
  getDealsPerMonth,
  getDealsPerDay,
  getStageDistribution,
  getAssociatePerformance,
  getRecentDeals,
} from '@/services/dashboardService';

const EMPTY_DEALS = [];

export function useDashboard() {
  const query = useDealsQuery();
  const deals = query.data ?? EMPTY_DEALS;

  const kpis = useMemo(() => getKpis(deals), [deals]);
  const dealsPerMonth = useMemo(() => getDealsPerMonth(deals), [deals]);
  const dealsPerDay = useMemo(() => getDealsPerDay(deals, 30), [deals]);
  // Closed/Axed are already covered by the KPI cards; mixing them into the stage
  // chart lets thousands of finished deals swamp the live pipeline view.
  const activeDeals = useMemo(() => deals.filter((d) => d.status === 'Active'), [deals]);
  const stageDistribution = useMemo(() => getStageDistribution(activeDeals), [activeDeals]);
  const associatePerformance = useMemo(() => getAssociatePerformance(deals, 8), [deals]);
  const recentDeals = useMemo(() => getRecentDeals(deals, 8), [deals]);

  return {
    kpis,
    dealsPerMonth,
    dealsPerDay,
    stageDistribution,
    associatePerformance,
    recentDeals,
    hasData: deals.length > 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
