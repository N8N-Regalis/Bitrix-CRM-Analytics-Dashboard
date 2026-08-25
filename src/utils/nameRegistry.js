// In-memory roster of everyone Bitrix knows about, loaded once per app load.
//
// Supabase has no join from deals.assigned_by_id or deals.contact_id to a name,
// so namesService fills this store from the `associates` and `clients` tables
// and the lookups in dealMeta.js read it. An id missing here is what produces
// "Associate #359" / "Client #673".
//
// Deliberately a plain module-level store rather than React state: the label
// lookups are synchronous and are called from dealService while normalizing
// rows, long before any component renders. Deal fetches await
// ensureLiveNames() first, so the store is always populated before it's read.

const associateNames = new Map();
const associateEmails = new Map();
const associateTeamLeads = new Map();
const associateTeams = new Map();
const inactiveAssociates = new Set();
const clientNames = new Map();
const clientStatuses = new Map();
const clientDealFlowStarts = new Map();

// Bumped on every registration so derived caches (resolveClientName's index)
// know to rebuild rather than serve a pre-overlay result.
let revision = 0;

export function getNameRevision() {
  return revision;
}

function registerInto(target, entries) {
  let changed = false;
  for (const [id, value] of entries) {
    if (id === null || id === undefined || !value) continue;
    const key = String(id);
    if (target.get(key) !== value) {
      target.set(key, value);
      changed = true;
    }
  }
  if (changed) revision += 1;
  return changed;
}

export function registerAssociateNames(entries) {
  return registerInto(associateNames, entries);
}

/** Keyed by lowercased address, since submissions rows and Google sign-in
 * both supply emails with arbitrary casing. */
export function registerAssociateEmails(entries) {
  return registerInto(
    associateEmails,
    entries.map(([email, name]) => [email ? String(email).toLowerCase().trim() : email, name])
  );
}

/** associate id -> their team lead's associate id, from
 * associates.team_leader_id. Rows with no lead are skipped by registerInto's
 * falsy guard, so "absent" and "no lead" are the same lookup miss. */
export function registerAssociateTeamLeads(entries) {
  return registerInto(associateTeamLeads, entries);
}

export function lookupAssociateTeamLeadId(id) {
  return associateTeamLeads.get(String(id));
}

/** The ids that appear as somebody's team lead. A lead has no lead of their
 * own, so this set is the only way to tell one apart from an associate who
 * simply has no lead assigned -- both have an empty team_leader_id. */
export function liveTeamLeadIds() {
  return new Set(associateTeamLeads.values());
}

/**
 * associate id -> the team they sit on, from associates.team_leader_name --
 * Bitrix free text holding the lead's short name ("EA", "Rox", "Lemon"), not an
 * id. It is what the Presented Deals team filter groups by, since it is the
 * only field that names a team; team_leader_id is the same relationship keyed
 * by the lead's record.
 *
 * Leads themselves have no value here (nobody leads them), so an id-keyed
 * lookup alone files their own book of business outside their team; see
 * getAssociateTeam in dealMeta.js for where that is put right.
 */
export function registerAssociateTeams(entries) {
  return registerInto(associateTeams, entries);
}

/** [associate id, team] pairs, for the derived name-keyed index in dealMeta. */
export function liveAssociateTeams() {
  return associateTeams.entries();
}

/** [associate id, display name] pairs, same. */
export function liveAssociateNames() {
  return associateNames.entries();
}

/**
 * Ids that Bitrix flags is_active=false -- departed staff who still own their
 * historical deals.
 *
 * Deliberately a set of the inactive ones rather than an id->boolean map:
 * registerInto() drops falsy values, and `false` is precisely the value this
 * needs to keep. Like the maps above it only ever grows within a page load, so
 * someone reactivated in Bitrix mid-session stays marked until the next reload.
 */
export function registerInactiveAssociates(ids) {
  let changed = false;
  for (const id of ids) {
    if (id === null || id === undefined) continue;
    const key = String(id);
    if (!inactiveAssociates.has(key)) {
      inactiveAssociates.add(key);
      changed = true;
    }
  }
  if (changed) revision += 1;
  return changed;
}

export function isInactiveAssociate(id) {
  return inactiveAssociates.has(String(id));
}

export function registerClientNames(entries) {
  return registerInto(clientNames, entries);
}

export function registerClientStatuses(entries) {
  return registerInto(clientStatuses, entries);
}

/** client id -> the day they entered deal flow, from
 * clients.deal_flow_start_date. A plain 'YYYY-MM-DD' string, never a Date: the
 * column is a calendar day with no time or zone, and parsing it here would only
 * hand every reader a timestamp to mis-anchor (see formatDateOnly). */
export function registerClientDealFlowStarts(entries) {
  return registerInto(clientDealFlowStarts, entries);
}

export function lookupAssociateName(id) {
  return associateNames.get(String(id));
}

export function lookupAssociateNameByEmail(email) {
  if (!email) return undefined;
  return associateEmails.get(String(email).toLowerCase().trim());
}

/** Plain object of email -> name, for the submissions aggregation that indexes
 * by address rather than looking up one at a time. */
export function associateEmailMap() {
  return Object.fromEntries(associateEmails);
}

export function lookupClientName(id) {
  return clientNames.get(String(id));
}

export function lookupClientStatus(id) {
  return clientStatuses.get(String(id));
}

export function lookupClientDealFlowStart(id) {
  return clientDealFlowStarts.get(String(id));
}

/** Every known client name. Used to build the partner-name matching index in
 * dealMeta.js. */
export function liveClientNames() {
  return clientNames.values();
}

/** Every known client id, so the Clients page can list clients that have no
 * deals yet rather than only those appearing in the deal rows. */
export function liveClientIds() {
  return clientNames.keys();
}

/** [client id, display name] pairs, for the name-keyed profile index in
 * dealMeta -- the reports that only ever know a client by name. */
export function liveClientEntries() {
  return clientNames.entries();
}
