import { InfoCard } from "@/components/cards/InfoCard";
import { TableSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { formatDuration, formatDate } from "@/utils/format";
import { cn } from "@/utils/cn";

const STALLED_WARNING_DAYS = 14;
const STALLED_CRITICAL_DAYS = 30;

function daysColor(days) {
  if (days >= STALLED_CRITICAL_DAYS) return "text-status-critical";
  if (days >= STALLED_WARNING_DAYS) return "text-status-warning";
  return "text-muted-foreground";
}

export function StalledDealsTable({ deals = [], isLoading, className }) {
  if (isLoading)
    return <TableSkeleton rows={8} columns={6} className={className} />;

  return (
    <InfoCard
      title="Longest-Stalled Deals"
      subtitle="Currently open deals, sorted by time spent in their current stage"
      className={className}
      contentClassName="p-0"
    >
      {deals.length === 0 ? (
        <div className="p-5">
          <EmptyState title="No deals currently in flight" />
        </div>
      ) : (
        <div className="max-h-[600px] overflow-y-auto scrollbar-thin">
          <table className="w-full">
            <thead className="sticky top-0 bg-background">
              <tr>
                <th className="table-th">Deal ID</th>
                <th className="table-th">Deal</th>
                <th className="table-th">Owner</th>
                <th className="table-th">Client</th>
                <th className="table-th">Current Stage</th>
                <th className="table-th">Deal Last Updated</th>
                <th className="table-th text-right">Time in Stage</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => (
                <tr
                  key={deal.dealId}
                  className="transition-colors hover:bg-muted/40"
                >
                  <td className="table-td text-muted-foreground">
                    {deal.dealId}
                  </td>
                  <td className="table-td max-w-[220px] truncate font-medium text-foreground">
                    {deal.title}
                  </td>
                  <td className="table-td text-muted-foreground">
                    {deal.ownerLabel}
                  </td>
                  <td className="table-td text-muted-foreground">
                    {deal.clientLabel}
                  </td>
                  <td className="table-td text-muted-foreground">
                    {deal.stageLabel}
                  </td>
                  <td className="table-td text-muted-foreground text-sm">
                    {formatDate(deal.updatedAt)}
                  </td>
                  <td
                    className={cn(
                      "table-td text-right font-medium",
                      daysColor(deal.daysInStage),
                    )}
                  >
                    {formatDuration(deal.daysInStage)}
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      since {formatDate(deal.enteredAt)}
                    </span>
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
