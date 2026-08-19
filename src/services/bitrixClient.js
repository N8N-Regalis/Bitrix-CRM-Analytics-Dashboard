// Browser-side entry point for every Bitrix REST call.
//
// Always goes through the same-origin /api/bitrix proxy -- the Vite dev server
// in development (vite.config.js), a Netlify function in production
// (netlify/functions/bitrix.mjs). The webhook secret lives only on that side,
// so nothing in this file or its callers is sensitive. Both ends enforce the
// read-only allowlist in utils/bitrixMethods.js.

const PROXY_BASE = '/api/bitrix';

/** Params whose value is an array are repeated (`select[]=ID&select[]=NAME`),
 * which is how Bitrix expects list-valued arguments. */
function buildQuery(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) value.forEach((item) => search.append(key, item));
    else search.append(key, value);
  }
  return search;
}

export async function bitrixRequest(method, params = {}) {
  const search = buildQuery(params);
  const response = await fetch(`${PROXY_BASE}/${method}.json?${search}`);
  const data = await response.json().catch(() => null);

  if (!response.ok || !data || data.error) {
    const detail = data?.error_description || data?.error || `HTTP ${response.status}`;
    throw new Error(`Bitrix ${method} failed: ${detail}`);
  }

  return data;
}

/**
 * Walks Bitrix's `next` cursor until the whole list is retrieved. Bitrix caps
 * every list method at 50 rows per response regardless of what you ask for, so
 * anything list-shaped has to be paginated.
 */
export async function bitrixList(method, params = {}) {
  const rows = [];
  let start = 0;

  for (;;) {
    const data = await bitrixRequest(method, { ...params, start });
    const batch = data.result ?? [];
    rows.push(...batch);

    if (batch.length === 0 || data.next === undefined) break;
    start = data.next;
  }

  return rows;
}
