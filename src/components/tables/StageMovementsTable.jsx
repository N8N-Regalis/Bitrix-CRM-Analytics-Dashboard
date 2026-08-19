import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { InfoCard } from '@/components/cards/InfoCard';
import { TableSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { getStageLabel } from '@/utils/dealMeta';
import { formatDuration, formatRelativeTime } from '@/utils/format';

export function StageMovementsTable({ rows = [], dealsById, isLoading, page, totalPages, onPageChange, total, pageSize, className }) {
  if (isLoading) return <TableSkeleton rows={10} columns={5} className={className} />;

  const rangeStart = rows.length ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <InfoCard
      title="Recent Stage Movements"
      subtitle="Every completed deal-to-deal stage change, most recent first"
      className={className}
      contentClassName="p-0"
      footer={
        rows.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-foreground">{rangeStart}</span>–
              <span className="font-medium text-foreground">{rangeEnd}</span> of{' '}
              <span className="font-medium text-foreground">{total.toLocaleString()}</span> movements
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
        )
      }
    >
      {rows.length === 0 ? (
        <div className="p-5">
          <EmptyState title="No stage movements recorded yet" message="Movements will appear here as deals progress through the pipeline." />
        </div>
      ) : (
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Deal ID</th>
                <th className="table-th">Deal</th>
                <th className="table-th">Owner</th>
                <th className="table-th">Move</th>
                <th className="table-th">When</th>
                <th className="table-th text-right">Time in Previous Stage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const deal = dealsById.get(row.deal_id);
                return (
                  <tr key={row.id} className="transition-colors hover:bg-muted/40">
                    <td className="table-td text-muted-foreground">{row.deal_id}</td>
                    <td className="table-td max-w-[220px] truncate font-medium text-foreground">
                      {deal?.title ?? `Deal #${row.deal_id}`}
                    </td>
                    <td className="table-td text-muted-foreground">{deal?.ownerLabel ?? 'Unknown'}</td>
                    <td className="table-td text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        {getStageLabel(row.from_stage_id)}
                        <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                        {getStageLabel(row.to_stage_id)}
                      </span>
                    </td>
                    <td className="table-td text-muted-foreground">{formatRelativeTime(row.left_at)}</td>
                    <td className="table-td text-right text-muted-foreground">{formatDuration(row.duration_days)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </InfoCard>
  );
}
