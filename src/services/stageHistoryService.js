import { supabase } from '@/services/supabase';

/**
 * Reads from the tables/views written by the separate "Bitrix Supabase Deal
 * History Sync Server" (syncs Bitrix24 crm.stagehistory.list into Supabase
 * every 15 minutes). This app only ever reads — never writes — these tables.
 *
 * stage_transitions rows already outnumber the deals table several times
 * over and grow continuously, so unlike dealService's "fetch everything
 * once" pattern, every query here is aggregated (via a Postgres view) or
 * bounded (filtered/sorted/limited) at the database level instead of
 * pulling the full table into the browser.
 */

/** Per from_stage_id aggregate (count, avg/min/max duration) — see migration
 * 006_create_stage_duration_stats_view.sql in the sync server repo. */
export async function fetchStageDurationStats() {
  const { data, error } = await supabase.from('stage_duration_stats').select('*');
  if (error) throw error;
  return data ?? [];
}

/** Per (from_stage_id, to_stage_id) pair aggregate — see migration
 * 007_create_stage_transition_counts_view.sql in the sync server repo. */
export async function fetchTopTransitions(limit = 15) {
  const { data, error } = await supabase
    .from('stage_transition_counts')
    .select('*')
    .order('transition_count', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Total count of completed stage-to-stage movements (excludes each deal's
 * still-open current stage, which has no to_stage_id yet). */
export async function fetchTotalMovementCount() {
  const { count, error } = await supabase
    .from('stage_transitions')
    .select('id', { count: 'exact', head: true })
    .not('to_stage_id', 'is', null);
  if (error) throw error;
  return count ?? 0;
}

/** Every deal's current, still-open stage_transitions row (to_stage_id IS
 * NULL). Bounded by how many deals are simultaneously "in flight", not by
 * total history volume, so this is safe to fetch in full. Paginated because
 * PostgREST's default 1000-row limit would truncate the result. */
export async function fetchOpenStageRows() {
  const rows = [];
  let from = 0;
  const pageSize = 1000;

  for (;;) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('stage_transitions')
      .select('deal_id, from_stage_id, entered_at')
      .is('to_stage_id', null)
      .order('entered_at', { ascending: true })
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

/** Completed transitions leaving one stage, optionally narrowed to a set of
 * destinations. The filters are applied at the database level, so this returns
 * a few thousand rows rather than the whole history table.
 *
 * Ordered oldest-first (`left_at` is stored in UTC throughout, so it sorts
 * directly) with `id` breaking ties, which keeps the ordering total and so
 * stops a page boundary landing mid-tie from repeating or skipping a row.
 * Callers rely on that order to pick a deal's most recent transition. */
export async function fetchTransitionsFromStage(fromStageId, toStageIds) {
  const rows = [];
  let from = 0;
  const pageSize = 1000;

  for (;;) {
    const to = from + pageSize - 1;
    let query = supabase
      .from('stage_transitions')
      .select('deal_id, to_stage_id, left_at')
      .eq('from_stage_id', fromStageId)
      .not('to_stage_id', 'is', null);

    if (toStageIds) query = query.in('to_stage_id', toStageIds);

    const { data, error } = await query
      .order('left_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

/** Full completed-transition history for a specific set of deals, oldest-first
 * per the ordering above. Chunked because `in(...)` goes into the request URL
 * and a few hundred ids is where that starts getting unwieldy; the caller is
 * expected to pass a bounded id list, not the whole deals table. */
export async function fetchTransitionsForDeals(dealIds) {
  const CHUNK = 200;
  const rows = [];

  for (let start = 0; start < dealIds.length; start += CHUNK) {
    const chunk = dealIds.slice(start, start + CHUNK);
    let from = 0;
    const pageSize = 1000;

    for (;;) {
      const to = from + pageSize - 1;
      const { data, error } = await supabase
        .from('stage_transitions')
        .select('deal_id, from_stage_id, to_stage_id, left_at')
        .in('deal_id', chunk)
        .not('to_stage_id', 'is', null)
        .order('left_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to);

      if (error) throw error;
      if (!data || data.length === 0) break;

      rows.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
  }

  return rows;
}

const PAGE_SIZE = 20;

/** Paginated, most-recent-first feed of completed stage movements. */
export async function fetchRecentTransitions(page = 1) {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count, error } = await supabase
    .from('stage_transitions')
    .select('id, deal_id, from_stage_id, to_stage_id, entered_at, left_at, duration_days', { count: 'exact' })
    .not('to_stage_id', 'is', null)
    .order('left_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0, page, pageSize: PAGE_SIZE };
}

/** Fetch all completed stage transitions (not paginated). Used for analytics
 * that need to examine the full history, not just recent. Paginated internally
 * to avoid PostgREST size limits. */
export async function fetchAllCompletedTransitions() {
  const rows = [];
  let from = 0;
  const pageSize = 1000;

  for (;;) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('stage_transitions')
      .select('id, deal_id, from_stage_id, to_stage_id, entered_at, left_at, duration_days')
      .not('to_stage_id', 'is', null)
      .order('left_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}
