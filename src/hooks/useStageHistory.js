import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  fetchStageDurationStats,
  fetchTopTransitions,
  fetchTotalMovementCount,
  fetchOpenStageRows,
  fetchRecentTransitions,
  fetchAllCompletedTransitions,
} from '@/services/stageHistoryService';

const STALE_TIME = 5 * 60 * 1000;

export function useStageDurationStats() {
  return useQuery({
    queryKey: ['stageDurationStats'],
    queryFn: fetchStageDurationStats,
    staleTime: STALE_TIME,
  });
}

export function useTopTransitions(limit = 15) {
  return useQuery({
    queryKey: ['topTransitions', limit],
    queryFn: () => fetchTopTransitions(limit),
    staleTime: STALE_TIME,
  });
}

export function useTotalMovementCount() {
  return useQuery({
    queryKey: ['totalMovementCount'],
    queryFn: fetchTotalMovementCount,
    staleTime: STALE_TIME,
  });
}

export function useOpenStageRows() {
  return useQuery({
    queryKey: ['openStageRows'],
    queryFn: fetchOpenStageRows,
    staleTime: STALE_TIME,
  });
}

export function useRecentTransitions(page) {
  return useQuery({
    queryKey: ['recentTransitions', page],
    queryFn: () => fetchRecentTransitions(page),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
  });
}

export function useAllCompletedTransitions() {
  return useQuery({
    queryKey: ['allCompletedTransitions'],
    queryFn: fetchAllCompletedTransitions,
    staleTime: STALE_TIME,
  });
}
