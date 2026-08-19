import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, ReferenceLine, Cell } from 'recharts';
import { ChartCard } from '@/components/charts/ChartCard';
import { ChartTooltip, chartAxisProps, chartGridProps } from '@/components/charts/ChartTooltip';

const COLUMNS = [
  { key: 'month', label: 'Month' },
  { key: 'deals', label: 'Deals Created' },
  { key: 'growth', label: 'MoM Growth', format: (v) => (v === null ? '—' : `${v.toFixed(1)}%`) },
];

/** Month-over-month % change is a Δ-to-baseline case: diverging color
 * (positive/negative) around a zero reference line, not a plain bar. */
export function MonthlyGrowthChart({ data = [], isLoading, className }) {
  const chartData = data.filter((d) => d.growth !== null);
  const isEmpty = !isLoading && chartData.length === 0;

  return (
    <ChartCard
      title="Monthly Growth"
      subtitle="Month-over-month change in new deals"
      isLoading={isLoading}
      isEmpty={isEmpty}
      tableData={data}
      tableColumns={COLUMNS}
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }} barSize={24}>
          <CartesianGrid {...chartGridProps} />
          <XAxis {...chartAxisProps('month')} />
          <YAxis
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
            width={44}
          />
          <ReferenceLine y={0} stroke="hsl(var(--border))" />
          <Tooltip
            content={<ChartTooltip formatter={(value) => [`${value.toFixed(1)}%`, 'growth']} />}
            cursor={{ fill: 'hsl(var(--muted))' }}
          />
          <Bar dataKey="growth" radius={[4, 4, 4, 4]}>
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.growth >= 0 ? 'var(--diverging-pos)' : 'var(--diverging-neg)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
