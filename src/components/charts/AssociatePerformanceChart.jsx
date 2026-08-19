import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from 'recharts';
import { ChartCard } from '@/components/charts/ChartCard';
import { ChartTooltip, chartGridProps, truncateLabel } from '@/components/charts/ChartTooltip';

const COLUMNS = [
  { key: 'associate', label: 'Associate' },
  { key: 'total', label: 'Total' },
  { key: 'won', label: 'Won' },
  { key: 'active', label: 'Active' },
  { key: 'lost', label: 'Lost' },
];

function renderLegend() {
  return (
    <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--status-good)' }} /> Won
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--chart-1)' }} /> Active
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--status-critical)' }} /> Lost
      </span>
    </div>
  );
}

/** Won/Active/Lost are status meaning (pass/pending/fail), so they wear the
 * fixed status palette rather than generic categorical series colors. */
export function AssociatePerformanceChart({ data = [], isLoading, className }) {
  const isEmpty = !isLoading && data.length === 0;
  const rowHeight = 36;
  const height = Math.max(240, data.length * rowHeight);

  return (
    <ChartCard
      title="Associate Performance"
      subtitle={`Deal outcomes by associate, top ${data.length} by volume`}
      isLoading={isLoading}
      isEmpty={isEmpty}
      height={height}
      tableData={data}
      tableColumns={COLUMNS}
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }} barSize={18}>
          <CartesianGrid {...chartGridProps} horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="associate"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={140}
            tickFormatter={(value) => truncateLabel(value, 14)}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
          <Legend content={renderLegend} />
          <Bar dataKey="won" name="Won" stackId="status" fill="var(--status-good)" />
          <Bar dataKey="active" name="Active" stackId="status" fill="var(--chart-1)" />
          <Bar dataKey="lost" name="Lost" stackId="status" fill="var(--status-critical)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
