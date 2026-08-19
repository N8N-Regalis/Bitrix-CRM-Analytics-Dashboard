import { supabase } from '@/services/supabase';

/**
 * The Bitrix -> Supabase sync job keeps one `sync_state` row per feed it pulls.
 * `stage_history` is the feed behind the deals and stage transitions the
 * Presented Deals page counts, so its row is the one that dates that page.
 *
 * Its two timestamps mean different things, and the difference matters when
 * showing "last synced":
 *
 * - `last_run_at` is wall-clock: when the job last completed a pass.
 * - `last_synced_at` is a data watermark, not a clock reading. The job sets it
 *   to the newest CREATED_TIME among the Bitrix stage-history records that pass
 *   downloaded, and feeds it back as the `>=CREATED_TIME` filter for the next
 *   incremental pull. So it tracks the newest deal activity ingested, and on a
 *   quiet stretch it sits still even while the job runs perfectly on schedule.
 *
 * Both are returned: the run time is what "how current is this dashboard"
 * means, and the watermark says how far into Bitrix's own history that reaches.
 */
export const STAGE_HISTORY_SYNC_KEY = 'stage_history';

/** Null fields when the key has no row yet, so a missing feed reads as
 * "unknown" rather than throwing at a caller that only wants to display it. */
export async function fetchSyncState(syncKey) {
  const { data, error } = await supabase
    .from('sync_state')
    .select('last_synced_at, last_run_at, last_run_status')
    .eq('sync_key', syncKey)
    .maybeSingle();

  if (error) throw error;

  return {
    lastSyncedAt: data?.last_synced_at ?? null,
    lastRunAt: data?.last_run_at ?? null,
    lastRunStatus: data?.last_run_status ?? null,
  };
}
