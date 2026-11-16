import { useMemo } from "react";
import { CheckCircle2, Medal, Presentation, Trophy, XCircle } from "lucide-react";
import { InfoCard } from "@/components/cards/InfoCard";
import { StatCard } from "@/components/cards/StatCard";
import { TableSkeleton } from "@/components/common/LoadingSkeleton";
import {
  GroupedTableHead,
  METRICS,
  METRIC_CLASS,
  useSort,
  withMetricColumns,
} from "@/components/tables/presentedColumns";
import { HIDDEN_FILTER_TEAMS, NO_TEAM } from "@/utils/dealMeta";
import { formatNumber, formatPercent } from "@/utils/format";
import { cn } from "@/utils/cn";

// The same shape as the Presented Deals table below it, one level up: a team
// row is the sum of its associates' rows, so every column means exactly what it
// means there and the two tables reconcile column by column.
const COLUMNS = withMetricColumns({ key: "team", label: "Team" });

/** Presented first, because that is what the board ranks on; accepted breaks a
 * tie, and the name settles the rest so the order never wobbles between renders. */
function byPerformance(a, b) {
  return b.presented - a.presented || b.accepted - a.accepted || a.name.localeCompare(b.name);
}

/**
 * Rolls the associate rows up into one row per team, plus the headline figures
 * the tiles show. Built from the rows the page is already displaying, so the
 * board always agrees with the table underneath it under any filter.
 */
function buildLeaderboard(rows) {
  const byTeam = new Map();

  rows.forEach((row) => {
    const team = row.team || NO_TEAM;
    if (!byTeam.has(team)) {
      // `name` alongside `team` so a team bucket and an associate row are both
      // rankable by byPerformance, which tie-breaks on it.
      byTeam.set(
        team,
        METRICS.reduce((bucket, metric) => ({ ...bucket, [metric]: 0 }), { team, name: team }),
      );
    }

    const bucket = byTeam.get(team);
    METRICS.forEach((metric) => {
      bucket[metric] += row[metric] || 0;
    });
  });

  // Teams that aren't part of the leaderboard (see HIDDEN_FILTER_TEAMS) are
  // dropped here, so they neither get a row nor count toward the totals.
  const teams = Array.from(byTeam.values()).filter((team) => !HIDDEN_FILTER_TEAMS.has(team.team));

  const totals = METRICS.reduce(
    (sum, metric) => ({ ...sum, [metric]: teams.reduce((n, team) => n + team[metric], 0) }),
    {},
  );

  // NO_TEAM is a catch-all for associates the roster records no team for --
  // mostly departed staff -- so it can out-total a real team without being one.
  // It stays a row, but it can never be crowned.
  const rankedTeams = teams.filter((team) => team.team !== NO_TEAM).sort(byPerformance);
  // Associates, in contrast, are real people whichever bucket they fall in, so
  // the ones with no team are still eligible here.
  const rankedAssociates = [...rows].sort(byPerformance);

  const share = (metric) =>
    totals.presented > 0 ? (totals[metric] / totals.presented) * 100 : null;

  return {
    teams,
    totals,
    // Real teams only, so the tile can't report a count that includes the
    // No Team bucket as if it were one.
    teamCount: rankedTeams.length,
    topTeam: rankedTeams[0] ?? null,
    topAssociate: rankedAssociates[0] ?? null,
    // Shares of presented, not of each other: the five outcome buckets don't
    // sum to presented (a deal whose move out of Video Presentation was never
    // recorded as a transition lands in none of them), so these two rates
    // deliberately don't add up to 100%.
    acceptanceRate: share("accepted"),
    rejectionRate: share("rejected"),
  };
}

/**
 * Presented deals ranked by team, above the associate-level table.
 *
 * `rows` are the associate rows the page is showing, already filtered -- pass
 * the filtered set rather than the raw one so a date range, a search or a team
 * selection moves this board and the table below it together.
 */
export function TeamLeaderboard({ rows = [], isLoading, className }) {
  const [sort, toggleSort] = useSort("presented");

  const { teams, totals, teamCount, topTeam, topAssociate, acceptanceRate, rejectionRate } =
    useMemo(() => buildLeaderboard(rows), [rows]);

  const sortedTeams = useMemo(() => {
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...teams].sort((a, b) => {
      if (sort.field === "team") return a.team.localeCompare(b.team) * dir;
      const [av, bv] = [a[sort.field] || 0, b[sort.field] || 0];
      return (av > bv ? 1 : av < bv ? -1 : 0) * dir || a.team.localeCompare(b.team);
    });
  }, [teams, sort]);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Top Team"
          value={topTeam?.team ?? null}
          sub={topTeam ? `${formatNumber(topTeam.presented)} presented` : undefined}
          icon={Trophy}
          color="indigo"
          description="Team with the most presented deals in the current view. The No Team bucket is excluded — it collects associates the roster records no team for, not a team."
          isLoading={isLoading}
        />
        <StatCard
          label="Top Associate"
          value={topAssociate?.name ?? null}
          sub={topAssociate ? `${formatNumber(topAssociate.presented)} presented` : undefined}
          icon={Medal}
          color="purple"
          description="Associate with the most presented deals in the current view"
          isLoading={isLoading}
        />
      </div>

      <InfoCard
        title="Leaderboard"
        subtitle="Presented deals by team. Each row sums the associates on that team, so the columns mean exactly what they do in the table below."
        contentClassName="p-0"
      >
        {isLoading ? (
          <TableSkeleton rows={5} columns={COLUMNS.length} className="border-0 shadow-none" />
        ) : sortedTeams.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No presented deals match your filters.
          </div>
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full">
              <GroupedTableHead columns={COLUMNS} sort={sort} onSort={toggleSort} />
              <tbody>
                {sortedTeams.map((team) => (
                  <tr key={team.team} className="transition-colors hover:bg-muted/40">
                    <td className="table-td font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        {/* Pinned to the leader, not to the first row, so it
                            still points at the same team when the board is
                            re-sorted by another column. */}
                        {topTeam?.team === team.team && (
                          <Trophy className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                        )}
                        <span className="truncate">{team.team}</span>
                      </div>
                    </td>
                    {METRICS.map((metric) => (
                      <td
                        key={metric}
                        className={cn(
                          "table-td text-right font-semibold tabular-nums",
                          METRIC_CLASS[metric],
                        )}
                      >
                        {formatNumber(team[metric])}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-muted/50">
                  <td className="table-td font-semibold uppercase tracking-wider text-foreground">
                    Total
                  </td>
                  {METRICS.map((metric) => (
                    <td
                      key={metric}
                      className={cn(
                        "table-td text-right font-bold tabular-nums",
                        METRIC_CLASS[metric],
                      )}
                    >
                      {formatNumber(totals[metric])}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </InfoCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Presented"
          value={formatNumber(totals.presented)}
          sub={`across ${teamCount} ${teamCount === 1 ? "team" : "teams"}`}
          icon={Presentation}
          color="primary"
          description="Presented deals in the current view — the figure both rates are measured against. The team count leaves out the No Team bucket, though its deals are still in the total."
          isLoading={isLoading}
        />
        <StatCard
          label="Acceptance Rate"
          value={formatPercent(acceptanceRate, 0)}
          sub={`${formatNumber(totals.accepted)} accepted`}
          icon={CheckCircle2}
          color="good"
          description="Accepted as a share of presented deals"
          isLoading={isLoading}
        />
        <StatCard
          label="Rejection Rate"
          value={formatPercent(rejectionRate, 0)}
          sub={`${formatNumber(totals.rejected)} rejected`}
          icon={XCircle}
          color="critical"
          description="Rejected as a share of presented deals, not counting auto-axed ones (the partner never responded), which have their own column. This and the acceptance rate don't add up to 100% — auto-axed deals, deals on hold, awaiting response, or with no recorded move make up the rest."
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
