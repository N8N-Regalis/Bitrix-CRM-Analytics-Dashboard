// Service-role Supabase client shared by the refresh scripts.
//
// The `associates` and `clients` tables are readable by the anon key but
// writable only by this one, which bypasses RLS. Like BITRIX_WEBHOOK_BASE it is
// deliberately NOT VITE_-prefixed: Vite inlines every VITE_ variable into the
// client bundle at build time, which would hand write access to every visitor.

import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  // No session handling wanted in a one-shot script; without this the client
  // keeps a refresh timer alive and the process hangs instead of exiting.
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Chunked so a full contact list doesn't go up as one oversized request.
const CHUNK_SIZE = 500;

/**
 * Upserts on the primary key. Columns absent from the payload keep whatever is
 * already in the row, which is what protects the hand-set `name_override` from
 * being flattened on every run -- so don't add it to these payloads.
 *
 * PostgREST requires every row in a batch to carry the same keys, so callers
 * must pass null rather than omitting a field on some rows.
 */
export async function upsertAll(supabase, table, rows, onConflict = 'bitrix_id') {
  for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
    const chunk = rows.slice(index, index + CHUNK_SIZE);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) {
      throw new Error(`${table} upsert failed: ${error.message}`);
    }
  }

  return rows.length;
}
