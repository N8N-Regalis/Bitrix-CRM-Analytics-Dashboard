import { X } from 'lucide-react';
import { cn } from '@/utils/cn';

export function FilterBar({ children, onReset, hasActiveFilters, className }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3', className)}>
      {children}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Clear filters
        </button>
      )}
    </div>
  );
}
