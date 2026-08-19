import { useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import { InfoCard } from '@/components/cards/InfoCard';
import { Skeleton } from '@/components/common/LoadingSkeleton';
import { NoDataCard } from '@/components/common/NoDataCard';
import { cn } from '@/utils/cn';

/**
 * Wraps every chart with a title, optional actions, and a table-view twin
 * (every chart's data must be reachable without relying on hover/color alone).
 */
export function ChartCard({
  title,
  subtitle,
  actions,
  height = 320,
  isLoading,
  isEmpty,
  emptyMessage = 'No data available',
  tableData,
  tableColumns,
  className,
  children,
}) {
  const [view, setView] = useState('chart');
  const canShowTable = Boolean(tableData?.length && tableColumns?.length);

  return (
    <InfoCard
      title={title}
      subtitle={subtitle}
      className={className}
      actions={
        <>
          {actions}
          {canShowTable && !isEmpty && !isLoading && (
            <div className="flex items-center rounded-lg border border-border p-0.5">
              <button
                type="button"
                onClick={() => setView('chart')}
                aria-label="Show chart view"
                aria-pressed={view === 'chart'}
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
                  view === 'chart' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <BarChart3 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setView('table')}
                aria-label="Show table view"
                aria-pressed={view === 'table'}
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
                  view === 'table' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Table2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </>
      }
    >
      {isLoading ? (
        <div style={{ height }} className="flex flex-col justify-between py-1">
          <Skeleton className="h-full w-full" />
        </div>
      ) : isEmpty ? (
        <NoDataCard message={emptyMessage} height="" className="py-8" />
      ) : view === 'chart' ? (
        <div style={{ height }}>{children}</div>
      ) : (
        <div className="scrollbar-thin overflow-auto" style={{ maxHeight: height }}>
          <table className="w-full">
            <thead>
              <tr>
                {tableColumns.map((col) => (
                  <th key={col.key} className="table-th">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, i) => (
                <tr key={i}>
                  {tableColumns.map((col) => (
                    <td key={col.key} className="table-td">
                      {col.format ? col.format(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </InfoCard>
  );
}
