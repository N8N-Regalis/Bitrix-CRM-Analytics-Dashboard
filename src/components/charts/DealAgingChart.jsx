import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell } from 'recharts';
import { ChartCard } from '@/components/charts/ChartCard';
import { ChartTooltip, chartAxisProps, chartGridProps } from '@/components/charts/ChartTooltip';

const COLUMNS = [
  { key: 'label', label: 'Age Bucket' },
  { key: 'deals', label: 'Open Deals' },
];

/** Age bucket order carries meaning (older = more at-risk), so this is an
 * ordinal single-hue ramp rather than categorical colors. */
export function DealAgingChart({ data = [], isLoading, className }) {
  const isEmpty = !isLoading && data.every((d) => d.deals === 0);

  return (
    <ChartCard
      title="Deal Aging"
      subtitle="How long currently-open deals have been in the pipeline"
      isLoading={isLoading}
      isEmpty={isEmpty}
      tableData={data}
      tableColumns={COLUMNS}
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }} barSize={32}>
          <CartesianGrid {...chartGridProps} />
          <XAxis {...chartAxisProps('label')} />
          <YAxis
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={32}
          />
          <Tooltip
            content={<ChartTooltip formatter={(value) => [value, 'open deals']} />}
            cursor={{ fill: 'hsl(var(--muted))' }}
          />
          <Bar dataKey="deals" radius={[4, 4, 0, 0]}>
            {data.map((_, index) => (
              <Cell key={index} fill={`var(--ordinal-${Math.min(7, index + 1)})`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
