import {
  Handshake,
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { StatCard } from "@/components/cards/StatCard";
import { ChartCard } from "@/components/charts/ChartCard";
import { DealsTrendChart } from "@/components/charts/DealsTrendChart";
import { DealsPerDayChart } from "@/components/charts/DealsPerDayChart";
import { PipelineChart } from "@/components/charts/PipelineChart";
import { AssociatePerformanceChart } from "@/components/charts/AssociatePerformanceChart";
import { RecentDealsTable } from "@/components/tables/RecentDealsTable";
import { FilterBar } from "@/components/filters/FilterBar";
import { DateRangeFilter } from "@/components/filters/DateRangeFilter";
import { ErrorState } from "@/components/common/ErrorState";
import { useDashboard } from "@/hooks/useDashboard";
import { formatNumber } from "@/utils/format";
import { describeRange } from "@/utils/dateRange";
import { cn } from "@/utils/cn";

export default function Dashboard() {
  const {
    kpis,
    dealsPerMonth,
    dealsPerDay,
    perDaySpan,
    maxPerDaySpan,
    stageDistribution,
    associatePerformance,
    recentDeals,
    filters,
    setDateFrom,
    setDateTo,
    resetFilters,
    hasActiveFilters,
    appliedRange,
    isRangeApplied,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useDashboard();

  const appliedRangeLabel = describeRange(
    appliedRange.dateFrom,
    appliedRange.dateTo,
  );

  // Every figure on the page is filtered by *created* date, so under a range the
  // status cards mean "created in this window and now sitting here" -- not
  // "closed in this window". The descriptions say so outright rather than
  // leaving the reader to assume the more natural second reading.
  const describes = {
    total: isRangeApplied
      ? `Deals created ${appliedRangeLabel}`
      : "All deals synced from Bitrix24",
    active: isRangeApplied
      ? `Created ${appliedRangeLabel} and still open in the pipeline`
      : "Deals still open in the pipeline",
    won: isRangeApplied
      ? `Created ${appliedRangeLabel} and now at Deal Closed`
      : "Deals that reached Deal Closed",
    lost: isRangeApplied
      ? `Created ${appliedRangeLabel} and since axed`
      : "Deals that were axed",
  };

  return (
    <PageContainer
      title="Dashboard"
      subtitle="Executive overview of deal activity"
      isLoading={isLoading}
      actions={
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", isFetching && "animate-spin")}
          />
          Refresh
        </button>
      }
    >
      {isError ? (
        <ErrorState message={error?.message} onRetry={refetch} />
      ) : (
        <div className="space-y-6">
          <FilterBar onReset={resetFilters} hasActiveFilters={hasActiveFilters}>
            <DateRangeFilter
              from={filters.dateFrom}
              to={filters.dateTo}
              onChangeFrom={setDateFrom}
              onChangeTo={setDateTo}
            />
            {/* One date entered means that one day, so the applied window is
                stated outright rather than inferred from a half-filled pair. */}
            {appliedRangeLabel && (
              <span className="text-sm text-muted-foreground">
                Showing deals created{" "}
                <span className="font-medium text-foreground">
                  {appliedRangeLabel}
                </span>
              </span>
            )}
          </FilterBar>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Deals"
              value={formatNumber(kpis.total)}
              icon={Handshake}
              color="primary"
              description={describes.total}
              isLoading={isLoading}
            />
            <StatCard
              label="Active Deals"
              value={formatNumber(kpis.active)}
              icon={Activity}
              color="indigo"
              description={describes.active}
              isLoading={isLoading}
            />
            <StatCard
              label="Closed Deals"
              value={formatNumber(kpis.won)}
              icon={CheckCircle2}
              color="good"
              description={describes.won}
              isLoading={isLoading}
            />
            <StatCard
              label="Axed Deals"
              value={formatNumber(kpis.lost)}
              icon={XCircle}
              color="critical"
              description={describes.lost}
              isLoading={isLoading}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <DealsTrendChart
              data={dealsPerMonth}
              isLoading={isLoading}
              subtitle={
                isRangeApplied
                  ? `New deals entering the pipeline, ${appliedRangeLabel}`
                  : undefined
              }
            />
            <PipelineChart data={stageDistribution} isLoading={isLoading} />
          </div>

          {/* A range wider than the per-day chart can show says so in place of
              the chart -- silently dropping the section would read as a bug. */}
          {dealsPerDay ? (
            <DealsPerDayChart
              data={dealsPerDay}
              isLoading={isLoading}
              subtitle={isRangeApplied ? appliedRangeLabel : undefined}
            />
          ) : (
            <ChartCard
              title="Deals Created Per Day"
              subtitle={appliedRangeLabel}
              isLoading={isLoading}
              isEmpty
              emptyMessage={`That range covers ${formatNumber(perDaySpan)} days — too many to read a day at a time. Narrow it to ${maxPerDaySpan} days or fewer, or use the monthly trend above.`}
            />
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <AssociatePerformanceChart
              data={associatePerformance}
              isLoading={isLoading}
            />
            <RecentDealsTable deals={recentDeals} isLoading={isLoading} />
          </div>
        </div>
      )}
    </PageContainer>
  );
}
