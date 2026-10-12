import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAllSubmissions, SUBMISSIONS_QUERY_KEY } from '@/services/submissionsService';
import { fetchAssociateEmailMap } from '@/services/namesService';
import { fetchPresentedDeals } from '@/services/presentedDealsService';
import { nameKey } from '@/utils/nameMatch';
import { monthLabel, monthWindow } from '@/services/dashboardService';
import {
  getAssociateTeam,
  isDismissedAssociate,
  listTeams,
  resolveClientName,
} from '@/utils/dealMeta';
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
    queryKey: ['associate-emails'],
    queryFn: fetchAssociateEmailMap,
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
  const associateName = emailToName[email] || email || 'Unknown';
  return {
    associateName,
    clientName: resolveClientName(submission.partner_name) || 'Unknown Partner',
    // A submission has no deal, so no team lead of its own: it counts toward the
    // team its associate sits on in the roster. Presented deals carry their own.
    team: getAssociateTeam(associateName),
  };
}

/** A table row is an associate within a team -- an associate whose deals sit in
 * more than one team has one row per team. This is the key the page's filtered
 * rows are handed back to the export and the monthly chart by. */
function rowKey(associateName, team) {
  return `${nameKey(associateName)}|${team}`;
}

/**
 * The rows behind the table, filtered to the same window it is showing:
 * submission rows for the Sourced Deals column, presented deal rows for the
 * Presented Deals columns.
 *
 * `visibleRows` narrows the result to the table rows currently on screen
 * (associate + team), which is how the page's search, team and dismissed filters
 * are applied -- they all act on whole rows, so passing them reproduces the
 * selection exactly. Omit it for every row.
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
  visibleRows,
}) {
  const wanted = visibleRows ? new Set(visibleRows.map((row) => rowKey(row.name, row.team))) : null;
  const isVisible = (associateName, team) => !wanted || wanted.has(rowKey(associateName, team));

  const sourced = [];
  submissions.forEach((submission) => {
    if (!inDateRange(submission.source_date, dateFrom, dateTo)) return;

    const { associateName, clientName, team } = submissionIdentity(submission, emailToName);
    if (!isVisible(associateName, team)) return;

    sourced.push({
      ...submission,
      associate_name: associateName,
      client_name: clientName,
      team,
    });
  });

  const presented = presentedDeals.filter(
    (deal) =>
      inDateRange(deal.presentedDate, dateFrom, dateTo) &&
      isVisible(deal.associateName, deal.team)
  );

  return { sourced, presented };
}

/**
 * Presented deals bucketed by the calendar month of their Presented Date, split
 * into accepted and rejected -- the monthly view of the same figures the
 * leaderboard totals.
 *
 * The buckets come from monthWindow, so an applied range spans exactly the
 * months it covers and an unfiltered page shows the trailing 12, matching the
 * Dashboard's monthly trend. Deals outside that window are dropped rather than
 * folded into the end months: without a range the table behind this reaches
 * back years, and piling all of it onto the oldest bucket would read as a spike.
 *
 * `visibleRows` narrows to the table rows currently on screen, exactly as it
 * does in collectExportRows -- the page's search, team and dismissed filters all
 * act on whole rows, so passing them reproduces the visible selection.
 *
 * Accepted and rejected deliberately don't sum to presented: on hold, awaiting
 * response, and deals whose move out of Video Presentation was never recorded
 * make up the rest (see resolveOutcome). The acceptance rate is therefore a
 * share of presented, not of accepted + rejected -- the same basis the
 * leaderboard's rate uses, so the two agree.
 */
export function buildMonthlyPerformance({
  presentedDeals,
  dateFrom,
  dateTo,
  visibleRows,
}) {
  const wanted = visibleRows ? new Set(visibleRows.map((row) => rowKey(row.name, row.team))) : null;

  const months = monthWindow({ dateFrom, dateTo });
  const buckets = new Map(
    months.map((key) => [key, { presented: 0, accepted: 0, rejected: 0 }])
  );

  presentedDeals.forEach((deal) => {
    if (!deal.presentedDate) return; // undated rows can't be placed in a month
    if (!inDateRange(deal.presentedDate, dateFrom, dateTo)) return;
    if (wanted && !wanted.has(rowKey(deal.associateName, deal.team))) return;

    const bucket = buckets.get(deal.presentedDate.slice(0, 7));
    if (!bucket) return;

    bucket.presented += 1;
    if (deal.outcome === 'accepted') bucket.accepted += 1;
    else if (deal.outcome === 'rejected') bucket.rejected += 1;
  });

  return months.map((key) => {
    const bucket = buckets.get(key);
    return {
      month: monthLabel(key),
      ...bucket,
      // null, not 0, for a month with nothing presented -- there is no rate to
      // report, and formatPercent renders that as an em dash rather than "0%".
      acceptanceRate:
        bucket.presented > 0 ? (bucket.accepted / bucket.presented) * 100 : null,
    };
  });
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

  // The rows, and the team list the page's filter offers. Built together
  // because both read the name registry, which is a module store React cannot
  // depend on: recomputing them side by side is what keeps the options in step
  // with the rows once the roster has loaded.
  const { presentedDealsData, teams } = useMemo(() => {
    // associate + team key -> { name, team, clients: Map<client key, row> }.
    // The team is part of the key because it belongs to the deal: an associate
    // with deals filed under two team leads gets a row under each.
    const byAssociate = new Map();

    function getClientRow(associateName, team, clientName) {
      const associateKey = rowKey(associateName, team);
      if (!byAssociate.has(associateKey)) {
        byAssociate.set(associateKey, { name: associateName, team, clients: new Map() });
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

      const { associateName, clientName, team } = submissionIdentity(submission, emailToName);
      getClientRow(associateName, team, clientName).count += 1;
    });

    presentedDeals.forEach((deal) => {
      if (!inDateRange(deal.presentedDate, dateFrom, dateTo)) return;

      const row = getClientRow(deal.associateName, deal.team, deal.clientName);
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

    const rows = Array.from(byAssociate.values())
      .map(({ name, team, clients }) => {
        const clientRows = Array.from(clients.values()).sort(
          (a, b) => b.count - a.count || b.presented - a.presented
        );

        const sumOf = (field) =>
          clientRows.reduce((sum, client) => sum + client[field], 0);

        return {
          name,
          // Carried on the row so the filter, the stats and the export all read
          // the same value. Per deal for presented deals (getDealTeam), the
          // associate's roster team for sourced ones.
          team,
          // Same reasoning: the roster's is_active flag, reached by name.
          isDismissed: isDismissedAssociate(name),
          clients: clientRows,
          total: sumOf('count'),
          presented: sumOf('presented'),
          accepted: sumOf('accepted'),
          rejected: sumOf('rejected'),
          onHold: sumOf('onHold'),
          awaiting: sumOf('awaiting'),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name) || a.team.localeCompare(b.team));

    return { presentedDealsData: rows, teams: listTeams() };
  }, [submissions, emailToName, presentedDeals, dateFrom, dateTo]);

  const getExportRows = useCallback(
    (visibleRows) =>
      collectExportRows({
        submissions,
        emailToName,
        presentedDeals,
        dateFrom,
        dateTo,
        visibleRows,
      }),
    [submissions, emailToName, presentedDeals, dateFrom, dateTo]
  );

  // Takes the visible rows rather than reading a filter, because the filters
  // live in the page; it is the page's own memo that decides how often this
  // runs. Cheap either way -- it walks the presented rows only.
  const getMonthlyPerformance = useCallback(
    (visibleRows) =>
      buildMonthlyPerformance({ presentedDeals, dateFrom, dateTo, visibleRows }),
    [presentedDeals, dateFrom, dateTo]
  );

  return {
    presentedDealsData,
    teams,
    // Called when an export is requested, not on render -- see collectExportRows.
    getExportRows,
    getMonthlyPerformance,
    // The range actually applied, so the page can state it rather than leave
    // the reader to infer it from a half-filled pair of inputs.
    appliedRange: { dateFrom, dateTo },
    isLoading: submissionsQuery.isLoading || usersQuery.isLoading || presentedQuery.isLoading,
    isError: submissionsQuery.isError || usersQuery.isError || presentedQuery.isError,
    error: submissionsQuery.error || usersQuery.error || presentedQuery.error,
  };
}
