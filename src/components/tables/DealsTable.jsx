import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { StatusBadge } from '@/components/tables/StatusBadge';
import { TableSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { formatDate } from '@/utils/format';
import { cn } from '@/utils/cn';

const COLUMNS = [
  { key: 'id', label: 'Deal ID', sortable: true },
  { key: 'title', label: 'Deal Name', sortable: true },
  { key: 'ownerLabel', label: 'Owner', sortable: true },
  { key: 'clientLabel', label: 'Client', sortable: true },
  { key: 'stageLabel', label: 'Stage', sortable: true },
  { key: 'createdAt', label: 'Created', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
];

function SortIcon({ active, direction }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />;
  return direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}

export function DealsTable({
  deals = [],
  isLoading,
  sort,
  onSort,
  page,
  totalPages,
  onPageChange,
  totalFiltered,
  pageSize,
}) {
  if (isLoading) return <TableSkeleton rows={10} columns={7} />;

  if (deals.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <EmptyState title="No deals match your filters" message="Try adjusting or clearing the current filters." />
      </div>
    );
  }

  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalFiltered);

  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={cn('table-th', col.align === 'right' && 'text-right')}
                  aria-sort={sort.field === col.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      className={cn(
                        'inline-flex items-center gap-1 transition-colors hover:text-foreground',
                        col.align === 'right' && 'flex-row-reverse'
                      )}
                    >
                      {col.label}
                      <SortIcon active={sort.field === col.key} direction={sort.direction} />
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deals.map((deal) => (
              <tr key={deal.id} className="transition-colors hover:bg-muted/40">
                <td className="table-td text-muted-foreground">{deal.id}</td>
                <td className="table-td max-w-[240px] truncate font-medium text-foreground">{deal.title}</td>
                <td className="table-td text-muted-foreground">{deal.ownerLabel}</td>
                <td className="table-td text-muted-foreground">{deal.clientLabel}</td>
                <td className="table-td text-muted-foreground">{deal.stageLabel}</td>
                <td className="table-td text-muted-foreground">{formatDate(deal.createdAt)}</td>
                <td className="table-td">
                  <StatusBadge status={deal.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{rangeStart}</span>–
          <span className="font-medium text-foreground">{rangeEnd}</span> of{' '}
          <span className="font-medium text-foreground">{totalFiltered.toLocaleString()}</span> deals
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 text-sm text-muted-foreground">
            Page <span className="font-medium text-foreground">{page}</span> of{' '}
            <span className="font-medium text-foreground">{totalPages}</span>
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
