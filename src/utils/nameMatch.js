// The Presented Deals page joins two databases that share no ID: the
// `submissions` table (its own Supabase project, keyed by sourcer email and a
// free-text `partner_name`) and the Bitrix-synced `deals` table (keyed by
// assigned_by_id / contact_id). The only thing both sides carry is a person's
// name, so the join is by name -- which means the two spellings have to be
// reconciled first.
//
// The main discrepancy is whitespace: `submissions.partner_name` is written by
// hand and routinely contains doubled spaces ("Nate  Pummel") where Bitrix has
// one. Collapsing runs of whitespace lifts partner-name coverage from 0 of 210
// to 194 of 210. The remaining 16 differ by an actual middle name or a typo
// ("Gunnar Wislon Schultz") and are deliberately left unmatched rather than
// fuzzy-matched -- a wrong join would silently attribute one client's deals to
// another, which is worse than showing them as separate rows.

/** Display form: same name, with runs of whitespace collapsed to one space. */
export function cleanName(name) {
  return String(name ?? '').replace(/\s+/g, ' ').trim();
}

/** Join key: case- and whitespace-insensitive form of a name. Never displayed. */
export function nameKey(name) {
  return cleanName(name).toLowerCase();
}

/** Composite key for an (associate, client) pair. The separator cannot occur
 * in a name, so ("Ann Lee", "Kim") and ("Ann", "Lee Kim") stay distinct. */
export function pairKey(associateName, clientName) {
  return nameKey(associateName) + '||' + nameKey(clientName);
}
