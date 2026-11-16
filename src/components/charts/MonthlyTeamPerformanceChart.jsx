import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from 'recharts';
import { ChartCard } from '@/components/charts/ChartCard';
import { ChartTooltip, chartAxisProps, chartGridProps } from '@/components/charts/ChartTooltip';
import { formatPercent } from '@/utils/format';

// Presented leads, then the two outcomes the card is about, then the rate --
// so a reader can see what each month's accepted count is a share of without
// leaving the table.
const COLUMNS = [
  { key: 'month', label: 'Month' },
  { key: 'presented', label: 'Presented' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'autoAxed', label: 'Auto-Axed Deals' },
  { key: 'acceptanceRate', label: 'Acceptance Rate', format: (value) => formatPercent(value, 0) },
];

// A kind of rejection, so not a status colour of its own -- the tables ink the
// column muted for the same reason.
const AUTO_AXED_COLOR = 'hsl(var(--muted-foreground))';

function renderLegend() {
  return (
    <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--status-good)' }} /> Accepted
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--status-critical)' }} /> Rejected
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: AUTO_AXED_COLOR }} /> Auto-Axed Deals
      </span>
    </div>
  );
}

/**
 * Accepted vs. rejected presented deals, month by month, for whichever teams and
 * associates the page is currently showing. Auto-axed rejections get their own
 * bar and are not also counted in Rejected.
 *
 * The bars sit side by side rather than stacked: the outcomes don't add up
 * to the month's presented figure (deals on hold, awaiting a response, or with
 * no recorded move make up the rest), so stacking them would draw a total that
 * doesn't exist. Both wear the fixed status palette -- accepted and rejected are
 * pass/fail meaning, not two arbitrary series.
 *
 * `subtitle` names the window the buckets span; the default holds for the
 * trailing window shown when no date range is applied.
 */
export function MonthlyTeamPerformanceChart({
  data = [],
  isLoading,
  className,
  subtitle = 'Accepted vs. rejected presented deals, last 12 months',
}) {
  const isEmpty = !isLoading && data.every((d) => d.presented === 0);

  return (
    <ChartCard
      title="Monthly Team Performance"
      subtitle={subtitle}
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyMessage="No presented deals match your filters."
      tableData={data}
      tableColumns={COLUMNS}
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }} barGap={2}>
          <CartesianGrid {...chartGridProps} />
          <XAxis {...chartAxisProps('month')} />
          <YAxis
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={40}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
          <Legend content={renderLegend} />
          <Bar dataKey="accepted" name="Accepted" fill="var(--status-good)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="rejected" name="Rejected" fill="var(--status-critical)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="autoAxed" name="Auto-Axed Deals" fill={AUTO_AXED_COLOR} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
