import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { InfoCard } from "@/components/cards/InfoCard";
import { TableSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { formatNumber } from "@/utils/format";

export function ValuationModelingReportTable({
  data = [],
  isLoading,
  className,
}) {
  const [expandedAssociate, setExpandedAssociate] = useState(null);

  if (isLoading)
    return <TableSkeleton rows={10} columns={4} className={className} />;

  if (data.length === 0) {
    return (
      <InfoCard
        title="Valuation Modeling Stage Movement"
        subtitle="Deals moved from Valuation Modeling stage by Associate"
        className={className}
        contentClassName="p-5"
      >
        <EmptyState
          title="No data available"
          message="No deals have moved through Valuation Modeling stage yet."
        />
      </InfoCard>
    );
  }

  const totalReview = data.reduce(
    (sum, row) => sum + row.movedToReviewCount,
    0,
  );
  const totalAxed = data.reduce((sum, row) => sum + row.movedToAxedCount, 0);
  const totalStill = data.reduce((sum, row) => sum + row.stillInStageCount, 0);

  return (
    <InfoCard
      title="Valuation Modeling Stage Movement"
      subtitle="Deals moved from Valuation Modeling stage by Associate"
      className={className}
      contentClassName="p-0"
      footer={
        data.length > 0 && (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Total Moved to Valuation Model for Review:
              </span>
              <span className="font-medium text-foreground">
                {formatNumber(totalReview)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Total Moved to Axed:
              </span>
              <span className="font-medium text-foreground">
                {formatNumber(totalAxed)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Total Still in Valuation Modeling Stage:
              </span>
              <span className="font-medium text-foreground">
                {formatNumber(totalStill)}
              </span>
            </div>
          </div>
        )
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="w-10 px-4 py-3 text-left"></th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">
                Associate
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">
                Moved to Review
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">
                Moved to Axed
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">
                Still in Stage
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => {
              const isExpanded = expandedAssociate === index;
              return (
                <React.Fragment key={index}>
                  <tr className="border-b border-border/50 transition-colors hover:bg-muted/40">
                    <td className="w-10 px-4 py-3">
                      <button
                        onClick={() =>
                          setExpandedAssociate(isExpanded ? null : index)
                        }
                        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                        aria-label="Toggle details"
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {row.associate}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">
                      {formatNumber(row.movedToReviewCount)}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">
                      {formatNumber(row.movedToAxedCount)}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">
                      {formatNumber(row.stillInStageCount)}
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr>
                      <td
                        colSpan="5"
                        className="border-b border-border bg-muted/40 px-4 py-4"
                      >
                        <div className="space-y-5">
                          {row.movedToReviewIds.length > 0 && (
                            <div>
                              <h4 className="mb-3 text-sm font-semibold text-foreground">
                                Moved to Review ({row.movedToReviewCount})
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {row.movedToReviewIds.map((dealId) => (
                                  <span
                                    key={dealId}
                                    className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-900 dark:bg-blue-900/30 dark:text-blue-300"
                                  >
                                    {dealId}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {row.movedToAxedIds.length > 0 && (
                            <div>
                              <h4 className="mb-3 text-sm font-semibold text-foreground">
                                Moved to Axed ({row.movedToAxedCount})
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {row.movedToAxedIds.map((dealId) => (
                                  <span
                                    key={dealId}
                                    className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-900 dark:bg-red-900/30 dark:text-red-300"
                                  >
                                    {dealId}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {row.stillInStageIds.length > 0 && (
                            <div>
                              <h4 className="mb-3 text-sm font-semibold text-foreground">
                                Still in Stage ({row.stillInStageCount})
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {row.stillInStageIds.map((dealId) => (
                                  <span
                                    key={dealId}
                                    className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-300"
                                  >
                                    {dealId}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </InfoCard>
  );
}
