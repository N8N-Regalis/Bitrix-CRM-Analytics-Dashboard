import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { ChartCard } from '@/components/charts/ChartCard';
import { ChartTooltip, chartAxisProps, chartGridProps } from '@/components/charts/ChartTooltip';

const COLUMNS = [
  { key: 'month', label: 'Month' },
  { key: 'deals', label: 'Deals Created' },
];

export function DealsTrendChart({ data = [], isLoading, className }) {
  const isEmpty = !isLoading && data.every((d) => d.deals === 0);

  return (
    <ChartCard
      title="Deals Created Per Month"
      subtitle="New deals entering the pipeline, last 12 months"
      isLoading={isLoading}
      isEmpty={isEmpty}
      tableData={data}
      tableColumns={COLUMNS}
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid {...chartGridProps} />
          <XAxis {...chartAxisProps('month')} />
          <YAxis
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={40}
          />
          <Tooltip
            content={<ChartTooltip formatter={(value) => [value, 'deals']} />}
            cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="deals"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
