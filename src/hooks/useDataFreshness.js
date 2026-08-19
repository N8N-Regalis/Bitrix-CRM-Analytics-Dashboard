import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAllSubmissions, SUBMISSIONS_QUERY_KEY } from '@/services/submissionsService';
import { fetchSyncState, STAGE_HISTORY_SYNC_KEY } from '@/services/syncStateService';

const SYNC_POLL_MS = 5 * 60 * 1000;

// A run older than this is called out. Deliberately not tied to the job's cron
// (which is configurable server-side) -- the note states the gap as a fact
// rather than asserting a schedule was missed.
const STALE_RUN_MS = 60 * 60 * 1000;

/**
 * How current the Bitrix-synced side of the dashboard is: when the sync job
 * last ran, and how far into Bitrix's stage history that run reached (see
 * syncStateService for why those are different timestamps).
 *
 * Polled rather than read once, so a header left open on a screen doesn't keep
 * quoting the sync that was current at page load.
 */
export function usePresentedSyncState() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['sync-state', STAGE_HISTORY_SYNC_KEY],
    queryFn: () => fetchSyncState(STAGE_HISTORY_SYNC_KEY),
    staleTime: 60 * 1000,
    refetchInterval: SYNC_POLL_MS,
    refetchOnWindowFocus: true,
  });

  const lastRunAt = data?.lastRunAt ?? null;
  const runTime = lastRunAt ? new Date(lastRunAt).getTime() : null;

  return {
    lastRunAt,
    lastSyncedAt: data?.lastSyncedAt ?? null,
    lastRunStatus: data?.lastRunStatus ?? null,
    isStale: runTime !== null && Date.now() - runTime > STALE_RUN_MS,
    isPending,
    isError,
  };
}

/**
 * When this browser last pulled the submissions table the Sourced Deals column
 * counts. That Supabase project has no sync job to ask -- rows are written to
 * `submissions` continuously and nothing records a checkpoint -- so the fetch
 * itself is the timestamp: it says how stale the numbers on screen are.
 *
 * `enabled: false` makes this observe the cached query without owning it. The
 * fetch is ~100k rows across a hundred round trips, so it stays the Presented
 * Deals page's to trigger; a status widget on every page must not start it.
 */
export function useSourcedFetchedAt() {
  const queryClient = useQueryClient();

  const { dataUpdatedAt, isFetching, isError } = useQuery({
    queryKey: SUBMISSIONS_QUERY_KEY,
    queryFn: fetchAllSubmissions,
    enabled: false,
    notifyOnChangeProps: ['dataUpdatedAt', 'isFetching', 'isError'],
  });

  /**
   * Pull the table again on demand, since nothing else will: the query is
   * cached for five minutes and this is the only way to date the numbers to
   * now without a reload.
   *
   * Written into the shared cache entry rather than fetched separately, so the
   * Presented Deals table re-renders off the same result if it is open, and a
   * second click while a fetch is in flight joins that one instead of starting
   * another. `staleTime: 0` overrides the client-wide default, which would
   * otherwise hand back the cached rows and make the button do nothing.
   */
  const refresh = useCallback(
    () =>
      queryClient.fetchQuery({
        queryKey: SUBMISSIONS_QUERY_KEY,
        queryFn: fetchAllSubmissions,
        staleTime: 0,
      }),
    [queryClient]
  );

  // 0 until the query has ever resolved -- the caller shows "not loaded".
  return { fetchedAt: dataUpdatedAt || null, isFetching, isError, refresh };
}

export function useDataFreshness() {
  return {
    presented: usePresentedSyncState(),
    sourced: useSourcedFetchedAt(),
  };
}
