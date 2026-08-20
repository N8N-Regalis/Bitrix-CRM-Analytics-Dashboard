import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

export function PageContainer({
  title,
  subtitle,
  actions,
  isLoading = false,
  loadingLabel = 'Loading…',
  children,
  className,
}) {
  return (
    <div className="w-full">
      <div className="flex flex-col gap-3 px-4 pb-4 pt-6 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className={cn('relative px-4 pb-6 sm:px-6', className)}>
        {/* Scrim + spinner over the content while data is in flight. The per-card
            skeletons stay put underneath so the layout doesn't shift when the data
            lands, and pointer-events stay off so filters remain usable. */}
        {isLoading && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute inset-0 z-10 flex justify-center rounded-lg bg-background/60 backdrop-blur-[1px]"
          >
            {/* Sticky so the spinner follows the viewport instead of sitting
                below the fold on tall pages. */}
            <span className="sticky top-[25vh] flex h-fit items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-card">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium text-foreground">{loadingLabel}</span>
            </span>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
