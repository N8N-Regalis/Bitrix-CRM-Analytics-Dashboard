import { TrendingUp, Percent, Trophy, XCircle, Workflow } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { MetricCard } from '@/components/cards/MetricCard';
import { InfoCard } from '@/components/cards/InfoCard';
import { AssociatePerformanceChart } from '@/components/charts/AssociatePerformanceChart';
import { TeamLeadPerformanceChart } from '@/components/charts/TeamLeadPerformanceChart';
import { MonthlyGrowthChart } from '@/components/charts/MonthlyGrowthChart';
import { DealAgingChart } from '@/components/charts/DealAgingChart';
import { MonthlyTrendChart } from '@/components/charts/MonthlyTrendChart';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { CardSkeleton } from '@/components/common/LoadingSkeleton';
import { useAnalytics } from '@/hooks/useAnalytics';
import { formatNumber, formatPercent } from '@/utils/format';

export default function Analytics() {
  const {
    conversionRate,
    monthlyGrowth,
    dealsByAssociate,
    dealsByTeamLead,
    dealsByPipeline,
    dealAging,
    winLossRatio,
    monthlyTrend,
    isLoading,
    isError,
    error,
    refetch,
  } = useAnalytics();

  const latestGrowth = [...monthlyGrowth].reverse().find((m) => m.growth !== null);
  // "Finished" = closed + axed, i.e. every deal that reached an outcome.
  const finishedTotal = winLossRatio.won + winLossRatio.lost;
  const closedShare = finishedTotal > 0 ? (winLossRatio.won / finishedTotal) * 100 : 0;

  return (
    <PageContainer
      title="Analytics"
      subtitle="Conversion, growth, and pipeline trends"
      isLoading={isLoading}
    >
      {isError ? (
        <ErrorState message={error?.message} onRetry={refetch} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Conversion Rate"
              value={formatPercent(conversionRate.rate)}
              description={`${formatNumber(conversionRate.won)} closed vs. ${formatNumber(conversionRate.lost)} axed`}
              icon={Percent}
              accent="primary"
              isLoading={isLoading}
            />
            <MetricCard
              title="Monthly Growth"
              value={latestGrowth ? `${latestGrowth.growth >= 0 ? '+' : ''}${latestGrowth.growth.toFixed(1)}%` : '—'}
              description={latestGrowth ? `vs. previous month (${latestGrowth.month})` : 'Not enough data yet'}
              icon={TrendingUp}
              accent={latestGrowth && latestGrowth.growth < 0 ? 'critical' : 'good'}
              isLoading={isLoading}
            />
            <MetricCard
              title="Closed Deals"
              value={formatNumber(winLossRatio.won)}
              description={`${formatPercent(closedShare)} of finished deals`}
              icon={Trophy}
              accent="good"
              isLoading={isLoading}
            />
            <MetricCard
              title="Axed Deals"
              value={formatNumber(winLossRatio.lost)}
              description={`${formatPercent(100 - closedShare)} of finished deals`}
              icon={XCircle}
              accent="critical"
              isLoading={isLoading}
            />
          </div>

          <InfoCard title="Closed / Axed Ratio" subtitle="Share of finished deals that were closed vs. axed">
            {isLoading ? (
              <CardSkeleton className="border-0 shadow-none" />
            ) : finishedTotal === 0 ? (
              <EmptyState title="No finished deals yet" message="The closed/axed breakdown will appear once deals finish." />
            ) : (
              <div className="space-y-2">
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div style={{ width: `${closedShare}%`, backgroundColor: 'var(--status-good)' }} />
                  <div style={{ width: `${100 - closedShare}%`, backgroundColor: 'var(--status-critical)' }} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Closed — {formatNumber(winLossRatio.won)} ({formatPercent(closedShare)})</span>
                  <span>Axed — {formatNumber(winLossRatio.lost)} ({formatPercent(100 - closedShare)})</span>
                </div>
              </div>
            )}
          </InfoCard>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <MonthlyGrowthChart data={monthlyGrowth} isLoading={isLoading} />
            <MonthlyTrendChart data={monthlyTrend} isLoading={isLoading} />
          </div>

          <AssociatePerformanceChart data={dealsByAssociate} isLoading={isLoading} />

          <DealAgingChart data={dealAging} isLoading={isLoading} />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <InfoCard title="Deals by Pipeline" subtitle="Share of deals per Bitrix pipeline">
              {isLoading ? (
                <CardSkeleton className="border-0 shadow-none" />
              ) : (
                <div className="space-y-3">
                  {dealsByPipeline.map((pipeline) => (
                    <div key={pipeline.name} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-foreground">
                        <Workflow className="h-4 w-4 text-muted-foreground" />
                        {pipeline.name}
                      </span>
                      <span className="text-sm font-medium text-muted-foreground">{formatNumber(pipeline.value)} deals</span>
                    </div>
                  ))}
                  <p className="pt-1 text-xs text-muted-foreground">
                    Every deal currently flows through a single pipeline — a breakdown chart isn&rsquo;t meaningful until a
                    second pipeline exists in Bitrix.
                  </p>
                </div>
              )}
            </InfoCard>

            <TeamLeadPerformanceChart data={dealsByTeamLead} isLoading={isLoading} />
          </div>
        </div>
      )}
    </PageContainer>
  );
}
