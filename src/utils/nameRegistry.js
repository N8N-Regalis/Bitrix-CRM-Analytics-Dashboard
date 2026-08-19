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
const clientNames = new Map();
const clientStatuses = new Map();

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

export function registerClientNames(entries) {
  return registerInto(clientNames, entries);
}

export function registerClientStatuses(entries) {
  return registerInto(clientStatuses, entries);
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
