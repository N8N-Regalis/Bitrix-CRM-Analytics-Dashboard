import { ArrowRight } from 'lucide-react';
import { InfoCard } from '@/components/cards/InfoCard';
import { TableSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { getStageLabel } from '@/utils/dealMeta';
import { formatDuration, formatNumber } from '@/utils/format';

export function TopTransitionsTable({ transitions = [], isLoading, className }) {
  if (isLoading) return <TableSkeleton rows={8} columns={3} className={className} />;

  return (
    <InfoCard
      title="Top Stage Movements"
      subtitle="Which moves happen most often, and how long deals sat before making them"
      className={className}
      contentClassName="p-0"
    >
      {transitions.length === 0 ? (
        <div className="p-5">
          <EmptyState title="No stage movements recorded yet" />
        </div>
      ) : (
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Move</th>
                <th className="table-th text-right">Count</th>
                <th className="table-th text-right">Avg Time Before Move</th>
              </tr>
            </thead>
            <tbody>
              {transitions.map((row, i) => (
                <tr key={i} className="transition-colors hover:bg-muted/40">
                  <td className="table-td font-medium text-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      {getStageLabel(row.from_stage_id)}
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {getStageLabel(row.to_stage_id)}
                    </span>
                  </td>
                  <td className="table-td text-right text-muted-foreground">{formatNumber(row.transition_count)}</td>
                  <td className="table-td text-right text-muted-foreground">{formatDuration(Number(row.avg_duration_days))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </InfoCard>
  );
}
