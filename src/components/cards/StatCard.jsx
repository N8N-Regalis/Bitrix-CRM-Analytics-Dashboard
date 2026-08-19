import { ArrowDownRight, ArrowUpRight, Info } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CardSkeleton } from '@/components/common/LoadingSkeleton';

// 'good'/'warning'/'critical' use the fixed status palette (never themed) —
// reserve them for real state meaning (won/lost, stalled, at-risk).
// 'primary'/'indigo'/'purple' are plain identity accents.
const COLOR_STYLES = {
  primary: 'bg-primary/10 text-primary',
  good: 'bg-status-good/10 text-status-good',
  warning: 'bg-status-warning/10 text-status-warning',
  critical: 'bg-status-critical/10 text-status-critical',
  indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400',
  purple: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
};

export function StatCard({ label, value, sub, trend, color = 'primary', icon: Icon, description, isLoading, className }) {
  if (isLoading) return <CardSkeleton className={className} />;

  const trendPositive = typeof trend === 'number' && trend > 0;
  const trendNegative = typeof trend === 'number' && trend < 0;

  return (
    <div className={cn('rounded-xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-popover', className)}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            {description && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground">
                    <Info className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[220px]">{description}</TooltipContent>
              </Tooltip>
            )}
          </div>
          <p className="mt-1.5 truncate text-3xl font-bold text-card-foreground">
            {value === null || value === undefined ? '—' : value}
          </p>
          {(sub || typeof trend === 'number') && (
            <div className="mt-1.5 flex items-center gap-1 text-xs">
              {typeof trend === 'number' && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 font-medium',
                    trendPositive && 'text-status-good',
                    trendNegative && 'text-status-critical'
                  )}
                >
                  {trendPositive && <ArrowUpRight className="h-3 w-3" />}
                  {trendNegative && <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(trend).toFixed(1)}%
                </span>
              )}
              {sub && <span className="text-muted-foreground">{sub}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', COLOR_STYLES[color])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
