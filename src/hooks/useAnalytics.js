import { useMemo } from 'react';
import { useDealsQuery } from '@/hooks/useDeals';
import {
  getConversionRate,
  getMonthlyGrowth,
  getDealsByAssociate,
  getDealsByTeamLead,
  getDealsByPipeline,
  getDealAging,
  getWinLossRatio,
  getMonthlyTrend,
} from '@/services/analyticsService';

const EMPTY_DEALS = [];

export function useAnalytics() {
  const query = useDealsQuery();
  const deals = query.data ?? EMPTY_DEALS;

  const conversionRate = useMemo(() => getConversionRate(deals), [deals]);
  const monthlyGrowth = useMemo(() => getMonthlyGrowth(deals), [deals]);
  const dealsByAssociate = useMemo(() => getDealsByAssociate(deals, 10), [deals]);
  const dealsByTeamLead = useMemo(() => getDealsByTeamLead(deals), [deals]);
  const dealsByPipeline = useMemo(() => getDealsByPipeline(deals), [deals]);
  const dealAging = useMemo(() => getDealAging(deals), [deals]);
  const winLossRatio = useMemo(() => getWinLossRatio(deals), [deals]);
  const monthlyTrend = useMemo(() => getMonthlyTrend(deals), [deals]);

  return {
    conversionRate,
    monthlyGrowth,
    dealsByAssociate,
    dealsByTeamLead,
    dealsByPipeline,
    dealAging,
    winLossRatio,
    monthlyTrend,
    hasData: deals.length > 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
