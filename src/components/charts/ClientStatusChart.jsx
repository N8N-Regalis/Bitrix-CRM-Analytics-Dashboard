import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell } from 'recharts';
import { ChartCard } from '@/components/charts/ChartCard';
import { ChartTooltip, chartGridProps, truncateLabel } from '@/components/charts/ChartTooltip';

const COLUMNS = [
  { key: 'name', label: 'Status' },
  { key: 'value', label: 'Clients' },
];

/**
 * Client contacts grouped by lifecycle status. Status position is a funnel
 * (order carries meaning, see CLIENT_STATUS_ORDER) so this reads as an
 * ordinal single-hue ramp, not a categorical legend — same treatment as
 * PipelineChart for deal stage.
 */
export function ClientStatusChart({ data = [], isLoading, className }) {
  const isEmpty = !isLoading && data.length === 0;
  const rowHeight = 36;
  const height = Math.max(240, data.length * rowHeight);

  return (
    <ChartCard
      title="Client Status Distribution"
      subtitle="Where clients currently sit in the relationship lifecycle"
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
            dataKey="name"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={100}
            tickFormatter={(value) => truncateLabel(value, 16)}
          />
          <Tooltip
            content={<ChartTooltip formatter={(value) => [value, 'clients']} />}
            cursor={{ fill: 'hsl(var(--muted))' }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
