import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAllSubmissions, SUBMISSIONS_QUERY_KEY } from '@/services/submissionsService';
import { fetchBitrixUsers } from '@/services/bitrixUsersService';
import { fetchPresentedDeals } from '@/services/presentedDealsService';
import { nameKey } from '@/utils/nameMatch';
import { resolveClientName } from '@/utils/dealMeta';
import { resolveDateRange } from '@/utils/dateRange';

export function useSubmissionsQuery() {
  return useQuery({
    queryKey: SUBMISSIONS_QUERY_KEY,
    queryFn: fetchAllSubmissions,
    staleTime: 5 * 60 * 1000,
  });
}

export function useBitrixUsersQuery() {
  return useQuery({
    queryKey: ['bitrix-users'],
    queryFn: fetchBitrixUsers,
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

export function usePresentedDealsQuery() {
  return useQuery({
    queryKey: ['presented-deals'],
    queryFn: fetchPresentedDeals,
    staleTime: 5 * 60 * 1000,
  });
}

// Shared fallbacks for queries that haven't resolved yet. A fresh `[]` or `{}`
// per render would be a new reference every time, so the memo below -- which
// walks ~100k submission rows -- would rebuild on every keystroke in the search
// box instead of only when the data or date range actually changes.
const NO_ROWS = [];
const NO_NAMES = {};

/** Both sides carry a UTC calendar date as a `yyyy-mm-dd` string, and the date
 * inputs produce the same format, so the range test is a lexicographic string
 * compare. That avoids parsing the bounds into Date objects, where the local
 * timezone offset would quietly shift which day a row falls on. */
function inDateRange(date, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  if (!date) return false; // undated rows can't be placed in a range
  if (dateFrom && date < dateFrom) return false;
  if (dateTo && date > dateTo) return false;
  return true;
}

/**
 * The associate and client a submission is counted under. Shared by the
 * aggregate below and the export builder, so the rows an export hands over are
 * provably the same rows that produced the numbers rather than a second
 * derivation that can drift from it.
 */
function submissionIdentity(submission, emailToName) {
  const email = (submission.sourcer_email || '').toLowerCase().trim();
  return {
    associateName: emailToName[email] || email || 'Unknown',
    clientName: resolveClientName(submission.partner_name) || 'Unknown Partner',
  };
}

/**
 * The rows behind the table, filtered to the same window it is showing:
 * submission rows for the Sourced Deals column, presented deal rows for the
 * Presented Deals columns.
 *
 * `associateNames` narrows the result to the associates currently on screen,
 * which is how the page's search box is applied -- it filters whole associates,
 * so passing their names reproduces it exactly. Omit it for every associate.
 *
 * Submission rows are copied with their resolved names attached, so this is
 * built on demand rather than memoized: doing it on every render would clone
 * the whole table (six figures of rows) each time a filter changed, for data
 * only an export ever reads.
 */
export function collectExportRows({
  submissions,
  emailToName,
  presentedDeals,
  dateFrom,
  dateTo,
  associateNames,
}) {
  const wanted = associateNames ? new Set(associateNames.map(nameKey)) : null;
  const isVisible = (associateName) => !wanted || wanted.has(nameKey(associateName));

  const sourced = [];
  submissions.forEach((submission) => {
    if (!inDateRange(submission.source_date, dateFrom, dateTo)) return;

    const { associateName, clientName } = submissionIdentity(submission, emailToName);
    if (!isVisible(associateName)) return;

    sourced.push({ ...submission, associate_name: associateName, client_name: clientName });
  });

  const presented = presentedDeals.filter(
    (deal) => inDateRange(deal.presentedDate, dateFrom, dateTo) && isVisible(deal.associateName)
  );

  return { sourced, presented };
}

/**
 * Sourced and presented deal counts per associate, broken down by client, with
 * the presented figure split into accepted, rejected, on hold, and awaiting
 * response.
 *
 * The two numbers come from different databases with no shared ID -- sourced
 * from the `submissions` table, presented from the Bitrix-synced `deals` table
 * -- so they are matched on associate and client
 * name (see nameMatch.js). The two populations only partly overlap: some
 * associates own presented deals but have never logged a submission, and some
 * hand-typed partner names have no Bitrix client. Rather than drop those, both
 * sides are unioned, so a row can legitimately read 0 sourced / N presented or
 * the reverse. Each column then totals to its true figure independently.
 *
 * The date range filters each side by its own date: submissions by when they
 * were sourced, presented deals by their Presented Date. So in a filtered
 * range the two columns describe different sets of deals, each matching what
 * its header says.
 *
 * Both sides read the range through resolveDateRange, so one date entered means
 * that one day -- the same window the Deal Report dashboard these numbers get
 * checked against reports on.
 */
export function useSubmissions(rawDateFrom, rawDateTo) {
  const submissionsQuery = useSubmissionsQuery();
  const usersQuery = useBitrixUsersQuery();
  const presentedQuery = usePresentedDealsQuery();

  const { dateFrom, dateTo } = resolveDateRange(rawDateFrom, rawDateTo);

  const submissions = submissionsQuery.data ?? NO_ROWS;
  const emailToName = usersQuery.data ?? NO_NAMES;
  const presentedDeals = presentedQuery.data ?? NO_ROWS;

  const presentedDealsData = useMemo(() => {
    // associate key -> { name, clients: Map<client key, row> }
    const byAssociate = new Map();

    function getClientRow(associateName, clientName) {
      const associateKey = nameKey(associateName);
      if (!byAssociate.has(associateKey)) {
        byAssociate.set(associateKey, { name: associateName, clients: new Map() });
      }

      const { clients } = byAssociate.get(associateKey);
      const clientKey = nameKey(clientName);
      if (!clients.has(clientKey)) {
        clients.set(clientKey, {
          clientName,
          count: 0,
          presented: 0,
          accepted: 0,
          rejected: 0,
          onHold: 0,
          awaiting: 0,
        });
      }

      return clients.get(clientKey);
    }

    submissions.forEach((submission) => {
      if (!inDateRange(submission.source_date, dateFrom, dateTo)) return;

      const { associateName, clientName } = submissionIdentity(submission, emailToName);
      getClientRow(associateName, clientName).count += 1;
    });

    presentedDeals.forEach((deal) => {
      if (!inDateRange(deal.presentedDate, dateFrom, dateTo)) return;

      const row = getClientRow(deal.associateName, deal.clientName);
      row.presented += 1;
      // These break down the presented count, so they are filtered by the same
      // Presented Date and are mutually exclusive. They still don't sum to it:
      // a deal whose move out of Video Presentation was never recorded as a
      // transition is in none of them (see resolveOutcome).
      if (deal.outcome === 'accepted') row.accepted += 1;
      else if (deal.outcome === 'rejected') row.rejected += 1;
      else if (deal.outcome === 'onHold') row.onHold += 1;
      else if (deal.outcome === 'awaiting') row.awaiting += 1;
    });

    return Array.from(byAssociate.values())
      .map(({ name, clients }) => {
        const clientRows = Array.from(clients.values()).sort(
          (a, b) => b.count - a.count || b.presented - a.presented
        );

        const sumOf = (field) =>
          clientRows.reduce((sum, client) => sum + client[field], 0);

        return {
          name,
          clients: clientRows,
          total: sumOf('count'),
          presented: sumOf('presented'),
          accepted: sumOf('accepted'),
          rejected: sumOf('rejected'),
          onHold: sumOf('onHold'),
          awaiting: sumOf('awaiting'),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [submissions, emailToName, presentedDeals, dateFrom, dateTo]);

  const getExportRows = useCallback(
    (associateNames) =>
      collectExportRows({
        submissions,
        emailToName,
        presentedDeals,
        dateFrom,
        dateTo,
        associateNames,
      }),
    [submissions, emailToName, presentedDeals, dateFrom, dateTo]
  );

  return {
    presentedDealsData,
    // Called when an export is requested, not on render -- see collectExportRows.
    getExportRows,
    // The range actually applied, so the page can state it rather than leave
    // the reader to infer it from a half-filled pair of inputs.
    appliedRange: { dateFrom, dateTo },
    isLoading: submissionsQuery.isLoading || usersQuery.isLoading || presentedQuery.isLoading,
    isError: submissionsQuery.isError || usersQuery.isError || presentedQuery.isError,
    error: submissionsQuery.error || usersQuery.error || presentedQuery.error,
  };
}
