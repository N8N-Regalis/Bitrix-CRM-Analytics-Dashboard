import {
  Handshake,
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { StatCard } from "@/components/cards/StatCard";
import { DealsTrendChart } from "@/components/charts/DealsTrendChart";
import { DealsPerDayChart } from "@/components/charts/DealsPerDayChart";
import { PipelineChart } from "@/components/charts/PipelineChart";
import { AssociatePerformanceChart } from "@/components/charts/AssociatePerformanceChart";
import { RecentDealsTable } from "@/components/tables/RecentDealsTable";
import { ErrorState } from "@/components/common/ErrorState";
import { useDashboard } from "@/hooks/useDashboard";
import { formatNumber } from "@/utils/format";
import { cn } from "@/utils/cn";

export default function Dashboard() {
  const {
    kpis,
    dealsPerMonth,
    dealsPerDay,
    stageDistribution,
    associatePerformance,
    recentDeals,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useDashboard();

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Deals"
              value={formatNumber(kpis.total)}
              icon={Handshake}
              color="primary"
              description="All deals synced from Bitrix24"
              isLoading={isLoading}
            />
            <StatCard
              label="Active Deals"
              value={formatNumber(kpis.active)}
              icon={Activity}
              color="indigo"
              description="Deals still open in the pipeline"
              isLoading={isLoading}
            />
            <StatCard
              label="Closed Deals"
              value={formatNumber(kpis.won)}
              icon={CheckCircle2}
              color="good"
              description="Deals that reached Deal Closed"
              isLoading={isLoading}
            />
            <StatCard
              label="Axed Deals"
              value={formatNumber(kpis.lost)}
              icon={XCircle}
              color="critical"
              description="Deals that were axed"
              isLoading={isLoading}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <DealsTrendChart data={dealsPerMonth} isLoading={isLoading} />
            <PipelineChart data={stageDistribution} isLoading={isLoading} />
          </div>

          <DealsPerDayChart data={dealsPerDay} isLoading={isLoading} />

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
