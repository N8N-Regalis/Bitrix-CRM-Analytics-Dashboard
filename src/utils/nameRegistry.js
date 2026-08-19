// Runtime overlay on top of the associateNames.js / clientNames.js snapshots.
//
// Those snapshots are baked into the bundle at build time and drift as Bitrix
// gains people, which is what produces "Associate #359" / "Client #673". On
// every app load, bitrixNamesService fetches the current lists and registers
// them here; the lookups in dealMeta.js consult the overlay first and fall back
// to the snapshot. So the snapshots stop being the source of truth and become
// the offline fallback for when Bitrix is unreachable.
//
// Deliberately a plain module-level store rather than React state: the label
// lookups are synchronous and are called from dealService while normalizing
// rows, long before any component renders. Deal fetches await
// ensureLiveNames() first, so the overlay is always populated before it's read.

const associateNames = new Map();
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

export function registerClientNames(entries) {
  return registerInto(clientNames, entries);
}

export function registerClientStatuses(entries) {
  return registerInto(clientStatuses, entries);
}

export function lookupAssociateName(id) {
  return associateNames.get(String(id));
}

export function lookupClientName(id) {
  return clientNames.get(String(id));
}

export function lookupClientStatus(id) {
  return clientStatuses.get(String(id));
}

/** Every known client name, live overlay merged over the snapshot. Used to
 * build the partner-name matching index in dealMeta.js. */
export function liveClientNames() {
  return clientNames.values();
}
