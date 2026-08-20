import { supabase } from '@/services/supabase';
import { cleanName } from '@/utils/nameMatch';
import {
  associateEmailMap,
  registerAssociateEmails,
  registerAssociateNames,
  registerAssociateTeamLeads,
  registerAssociateTeams,
  registerInactiveAssociates,
  registerClientNames,
  registerClientStatuses,
  registerClientDealFlowStarts,
} from '@/utils/nameRegistry';

/**
 * Loads the associate and client rosters from Supabase once per app load and
 * registers them in nameRegistry, which is what resolves deals.assigned_by_id
 * and deals.contact_id into names.
 *
 * Replaces the old per-load fetch through the Bitrix proxy: a scheduled job now
 * keeps `associates` and `clients` current (see scripts/refresh-*.mjs), so this
 * is one round-trip against a table the browser already talks to rather than
 * ~5 paginated calls to Bitrix. The trade is freshness -- names are as current
 * as the last sync run rather than live per load.
 *
 * Awaited by every fetch that resolves those labels (dealService,
 * presentedDealsService), which is what guarantees the registry is populated
 * before any row is normalized.
 */

const PAGE_SIZE = 1000;

let pending = null;

export function ensureLiveNames() {
  if (!pending) {
    // Swallowed on purpose: there is no snapshot to fall back on any more, but
    // an unresolved name is a far better outcome than taking down a dashboard
    // whose deal data loaded fine. Clearing `pending` lets the next fetch retry.
    pending = loadNames().catch((error) => {
      console.warn('Name roster failed to load; IDs will render unresolved.', error);
      pending = null;
    });
  }
  return pending;
}

/** email -> display name, for the submissions rows whose only associate
 * identifier is an email address. */
export async function fetchAssociateEmailMap() {
  await ensureLiveNames();
  return associateEmailMap();
}

async function fetchAll(table, columns) {
  const rows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

async function loadNames() {
  // `display_name` resolves to name_override when someone has corrected a name
  // by hand, and to the Bitrix name otherwise -- see the table definition.
  const [associates, clients] = await Promise.all([
    fetchAll(
      'associates',
      'bitrix_id, display_name, email, team_leader_id, team_leader_name, is_active'
    ),
    fetchAll('clients', 'bitrix_id, display_name, status, deal_flow_start_date'),
  ]);

  registerAssociateNames(associates.map((row) => [row.bitrix_id, row.display_name]));
  registerAssociateEmails(associates.map((row) => [row.email, row.display_name]));
  registerAssociateTeamLeads(associates.map((row) => [row.bitrix_id, row.team_leader_id]));
  registerAssociateTeams(associates.map((row) => [row.bitrix_id, row.team_leader_name]));
  registerInactiveAssociates(associates.filter((row) => row.is_active === false).map((row) => row.bitrix_id));
  registerClientNames(clients.map((row) => [row.bitrix_id, cleanName(row.display_name)]));
  registerClientStatuses(clients.map((row) => [row.bitrix_id, row.status]));
  registerClientDealFlowStarts(clients.map((row) => [row.bitrix_id, row.deal_flow_start_date]));
}
