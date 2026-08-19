import { CalendarDays } from 'lucide-react';

// Reports only what the user typed. An earlier version seeded the empty bound
// from the filled one so a single pick would mean a single day, but `type="date"`
// fires onChange on every segment edit: typing the year 2026 emits 0002, 0020,
// 0202, 2026 in turn, so the seed landed on 0002-08-06 and then stuck, because
// the bound was no longer empty. Any write-back of a derived value into a date
// input has that hazard. The single-day rule lives in resolveDateRange instead,
// where no partially-typed value can reach it.
export function DateRangeFilter({ from, to, onChangeFrom, onChangeTo }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="date"
          value={from || ''}
          onChange={(e) => onChangeFrom(e.target.value || null)}
          aria-label="From date"
          className="h-9 w-[150px] rounded-lg border border-input bg-card pl-8 pr-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <span className="text-sm text-muted-foreground">to</span>
      <div className="relative">
        <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="date"
          value={to || ''}
          onChange={(e) => onChangeTo(e.target.value || null)}
          aria-label="To date"
          className="h-9 w-[150px] rounded-lg border border-input bg-card pl-8 pr-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </div>
  );
}
