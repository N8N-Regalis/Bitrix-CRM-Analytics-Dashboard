import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell } from 'recharts';
import { ChartCard } from '@/components/charts/ChartCard';
import { ChartTooltip, chartGridProps, truncateLabel } from '@/components/charts/ChartTooltip';
import { formatDuration } from '@/utils/format';

const COLUMNS = [
  { key: 'name', label: 'Stage' },
  { key: 'value', label: 'Avg Time', format: (v) => formatDuration(v) },
  { key: 'count', label: 'Movements' },
];

/**
 * Avg time deals spend in each stage before moving on. Stage position is a
 * funnel (order carries meaning) so this reads as an ordinal single-hue
 * ramp, not a categorical legend — same treatment as PipelineChart.
 */
export function StageDurationChart({ data = [], isLoading, className }) {
  const isEmpty = !isLoading && data.length === 0;
  const rowHeight = 36;
  const height = Math.max(240, data.length * rowHeight);

  return (
    <ChartCard
      title="Avg Time in Stage"
      subtitle="How long deals typically sit in each stage before moving on"
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
            tickFormatter={(value) => formatDuration(value)}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={150}
            tickFormatter={(value) => truncateLabel(value, 20)}
          />
          <Tooltip
            content={<ChartTooltip formatter={(value) => [formatDuration(value), 'avg time']} />}
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
