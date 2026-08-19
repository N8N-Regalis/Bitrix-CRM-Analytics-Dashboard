import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/utils/cn';
import { CardSkeleton } from '@/components/common/LoadingSkeleton';

const ACCENT_STYLES = {
  primary: 'text-primary',
  good: 'text-status-good',
  critical: 'text-status-critical',
  warning: 'text-status-warning',
};

export function MetricCard({ title, value, description, icon: Icon, trend, accent = 'primary', isLoading, children, className }) {
  if (isLoading) return <CardSkeleton className={className} />;

  const trendPositive = typeof trend === 'number' && trend > 0;
  const trendNegative = typeof trend === 'number' && trend < 0;

  return (
    <div className={cn('flex flex-col rounded-xl border border-border bg-card p-5 shadow-card', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {Icon && <Icon className={cn('h-4 w-4', ACCENT_STYLES[accent])} />}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <p className={cn('text-2xl font-bold', ACCENT_STYLES[accent])}>{value}</p>
        {typeof trend === 'number' && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium',
              trendPositive && 'text-status-good',
              trendNegative && 'text-status-critical',
              trend === 0 && 'text-muted-foreground'
            )}
          >
            {trendPositive && <ArrowUpRight className="h-3 w-3" />}
            {trendNegative && <ArrowDownRight className="h-3 w-3" />}
            {trend === 0 && <Minus className="h-3 w-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>

      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
