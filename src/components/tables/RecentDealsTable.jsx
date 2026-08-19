import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { InfoCard } from '@/components/cards/InfoCard';
import { StatusBadge } from '@/components/tables/StatusBadge';
import { TableSkeleton } from '@/components/common/LoadingSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { formatDate } from '@/utils/format';

export function RecentDealsTable({ deals = [], isLoading, className }) {
  if (isLoading) return <TableSkeleton rows={6} columns={5} className={className} />;

  return (
    <InfoCard
      title="Recent Deals"
      subtitle="Most recently created deals"
      className={className}
      contentClassName="p-0"
      actions={
        <Link to="/deals" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          View all
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      {deals.length === 0 ? (
        <div className="p-5">
          <EmptyState title="No deals yet" message="Deals will show up here once synced from Bitrix24." />
        </div>
      ) : (
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Deal Name</th>
                <th className="table-th">Owner</th>
                <th className="table-th">Client</th>
                <th className="table-th">Stage</th>
                <th className="table-th">Created</th>
                <th className="table-th">Status</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => (
                <tr key={deal.id} className="transition-colors hover:bg-muted/40">
                  <td className="table-td max-w-[220px] truncate font-medium text-foreground">{deal.title}</td>
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
      )}
    </InfoCard>
  );
}
