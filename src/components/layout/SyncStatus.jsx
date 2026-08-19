import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { format, isToday, isValid } from 'date-fns';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDataFreshness } from '@/hooks/useDataFreshness';
import { formatRelativeTime } from '@/utils/format';
import { cn } from '@/utils/cn';

// How often the "x minutes ago" labels are redrawn. Nothing here changes on
// its own otherwise, so without a tick the panel would freeze at whatever it
// said when it was last rendered for some other reason.
const TICK_MS = 30 * 1000;

function useTick(ms) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), ms);
    return () => clearInterval(timer);
  }, [ms]);
}

/** Time alone for today's stamps, since the day is implied and the header has
 * no room for it; the date comes back once it stops being today. */
function shortStamp(value) {
  const date = new Date(value);
  if (!isValid(date)) return null;
  return isToday(date) ? format(date, 'h:mm a') : format(date, 'MMM d, h:mm a');
}

function fullStamp(value) {
  const date = new Date(value);
  if (!isValid(date)) return null;
  return format(date, "MMM d, yyyy 'at' h:mm a");
}

function FreshnessRow({ label, note, value, fallback, action, children }) {
  return (
    <div className="px-2 py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          {value ? formatRelativeTime(value) : fallback}
          {action}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{value ? fullStamp(value) : note}</p>
      {children}
    </div>
  );
}

/**
 * Refetches the submissions table on demand. Kept as a plain button rather
 * than a DropdownMenuItem so the panel stays open while the fetch runs -- the
 * timestamp above it is the confirmation that it worked, and there is nothing
 * to see if the menu closes on click.
 */
function RefreshSourcedButton({ isFetching, onRefresh }) {
  async function handleClick() {
    if (isFetching) return;

    try {
      await onRefresh();
      toast.success('Sourced deals refreshed');
    } catch (error) {
      toast.error(`Could not refresh sourced deals: ${error.message}`);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isFetching}
      aria-label="Refresh sourced deals"
      title="Refresh sourced deals"
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground',
        'transition-colors hover:bg-muted hover:text-foreground',
        'disabled:pointer-events-none disabled:opacity-60'
      )}
    >
      <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
    </button>
  );
}

/**
 * Header readout of how current the dashboard's two datasets are. They come
 * from different databases and are dated differently -- presented deals by
 * when the Bitrix sync job last ran, sourced deals by when this browser pulled
 * them (see useDataFreshness) -- so they are listed separately rather than
 * merged into one number that would be true of neither.
 */
export function SyncStatus() {
  useTick(TICK_MS);
  const { presented, sourced } = useDataFreshness();

  const isBusy = presented.isPending || sourced.isFetching;
  const runFailed = presented.lastRunStatus !== null && presented.lastRunStatus !== 'success';
  const needsAttention = presented.isStale || runFailed || presented.isError;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="View data sync time"
          title="View data sync time"
          className={cn(
            'flex h-9 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground',
            'transition-colors hover:bg-muted hover:text-foreground',
            needsAttention && 'text-amber-600 dark:text-amber-500'
          )}
        >
          {needsAttention ? (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          ) : (
            <RefreshCw className={cn('h-4 w-4 shrink-0', isBusy && 'animate-spin')} />
          )}
          <span className="hidden whitespace-nowrap lg:inline">View Data Sync Time</span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="font-normal">
          <p className="font-semibold text-foreground">Data freshness</p>
          <p className="text-xs font-normal text-muted-foreground">Shown in your local time</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <FreshnessRow
          label="Presented Deals"
          note={presented.isError ? 'Sync status unavailable' : 'Checking Bitrix sync…'}
          value={presented.lastRunAt}
          fallback={presented.isError ? 'Unavailable' : 'Checking…'}
        >
          {/* The run above says when the job last worked; this says how far
              into Bitrix's own history it reached. They differ by however long
              the pipeline has been quiet, so both are shown rather than one
              standing in for the other. */}
          {presented.lastSyncedAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              Newest deal activity {shortStamp(presented.lastSyncedAt)}
            </p>
          )}
          {runFailed && (
            <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-500">
              Last run reported &ldquo;{presented.lastRunStatus}&rdquo;
            </p>
          )}
          {presented.isStale && !runFailed && (
            <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-500">
              No sync run in over an hour
            </p>
          )}
        </FreshnessRow>

        <DropdownMenuSeparator />

        <FreshnessRow
          label="Sourced Deals"
          note={sourced.isFetching ? 'Loading submissions…' : 'Loads with the Presented Deals page'}
          value={sourced.fetchedAt}
          fallback={sourced.isFetching ? 'Loading…' : 'Not loaded yet'}
          action={<RefreshSourcedButton isFetching={sourced.isFetching} onRefresh={sourced.refresh} />}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
