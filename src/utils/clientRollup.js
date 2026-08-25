import { nameKey } from '@/utils/nameMatch';
import { getClientProfile } from '@/utils/dealMeta';
import { METRICS } from '@/components/tables/presentedColumns';

/**
 * The Presented Deals report, rolled up by client instead of by associate.
 *
 * `rows` are the associate rows the page is showing, already filtered -- the
 * same ones the leaderboard and the associate table read, so every level of the
 * report describes the same selection.
 *
 * A client is usually worked by more than one associate and so appears under
 * several associate rows. Those are merged here on the same whitespace- and
 * case-insensitive key the rest of the join uses (nameMatch.js), with the first
 * spelling seen kept for display. The associates that contributed are kept on
 * the row, so a client can be expanded into who sourced and presented for it --
 * the associate table read the other way round.
 *
 * Sourced arrives as `count` on a client row and leaves as `total`, matching the
 * associate and team rows: that shared shape is what lets all three levels drive
 * the same columns and sort on the same keys (see presentedColumns.jsx). A row
 * also carries the client's own Bitrix attributes -- lifecycle status and deal
 * flow start -- which the associate rows it was built from never had.
 *
 * Ranking is by whichever of sourced and presented is larger, not by their sum.
 * The two figures come from different databases and a date range filters each by
 * its own date (see useSubmissions), so adding them would double-count a deal
 * that is in both, and would bury a client that has presented deals but no
 * matched submissions -- a row the union in that hook deliberately keeps.
 */
export function buildClientReport(rows = []) {
  const byClient = new Map();

  rows.forEach((associate) => {
    associate.clients.forEach((client) => {
      const key = nameKey(client.clientName);
      if (!byClient.has(key)) {
        // The client's own Bitrix record, joined on the same name key. Null for
        // a partner name that never matched a contact, which the table renders
        // as an em dash rather than inventing a status for it.
        const profile = getClientProfile(client.clientName);
        byClient.set(key, {
          clientName: client.clientName,
          status: profile?.status ?? null,
          dealFlowStart: profile?.dealFlowStart ?? null,
          associates: [],
          ...METRICS.reduce((bucket, metric) => ({ ...bucket, [metric]: 0 }), {}),
        });
      }

      const bucket = byClient.get(key);
      // The associate's slice of this client, in the row shape the columns read.
      const contribution = {
        name: associate.name,
        team: associate.team,
        total: client.count,
        presented: client.presented,
        accepted: client.accepted,
        rejected: client.rejected,
        onHold: client.onHold,
        awaiting: client.awaiting,
      };

      METRICS.forEach((metric) => {
        bucket[metric] += contribution[metric];
      });
      bucket.associates.push(contribution);
    });
  });

  return Array.from(byClient.values())
    .map((client) => ({
      ...client,
      associates: client.associates.sort(
        (a, b) =>
          b.total - a.total || b.presented - a.presented || a.name.localeCompare(b.name),
      ),
    }))
    .sort(
      (a, b) =>
        Math.max(b.total, b.presented) - Math.max(a.total, a.presented) ||
        b.total - a.total ||
        b.presented - a.presented ||
        // Settles ties by name so the order never wobbles between renders.
        a.clientName.localeCompare(b.clientName),
    );
}
