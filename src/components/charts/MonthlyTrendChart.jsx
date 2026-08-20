import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from 'recharts';
import { ChartCard } from '@/components/charts/ChartCard';
import { ChartTooltip, chartAxisProps, chartGridProps } from '@/components/charts/ChartTooltip';

const COLUMNS = [
  { key: 'month', label: 'Month' },
  { key: 'created', label: 'Created' },
  { key: 'won', label: 'Closed' },
  { key: 'lost', label: 'Axed' },
];

function renderLegend() {
  return (
    <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: 'var(--chart-1)' }} /> Created
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: 'var(--status-good)' }} /> Closed
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: 'var(--status-critical)' }} /> Axed
      </span>
    </div>
  );
}

/** Closed/Axed carry status meaning (pass/fail); Created is a neutral volume
 * line. Three series -> legend is mandatory, direct labels are not (skill: <=4). */
export function MonthlyTrendChart({ data = [], isLoading, className }) {
  const isEmpty = !isLoading && data.every((d) => d.created === 0);

  return (
    <ChartCard
      title="Monthly Trend"
      subtitle="Deals created vs. closed vs. axed, last 12 months"
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
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }} />
          <Legend content={renderLegend} />
          <Line type="monotone" dataKey="created" name="Created" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="won" name="Closed" stroke="var(--status-good)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="lost" name="Axed" stroke="var(--status-critical)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
