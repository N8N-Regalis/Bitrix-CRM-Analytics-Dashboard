import { useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { ChartCard } from '@/components/charts/ChartCard';
import { ChartTooltip, chartAxisProps, chartGridProps } from '@/components/charts/ChartTooltip';

const COLUMNS = [
  { key: 'day', label: 'Day' },
  { key: 'deals', label: 'Deals Created' },
];

const VISIBLE_DAYS = 10;
const DAY_WIDTH = 64;

/**
 * Unlike the other trend charts, this one is wider than its card — only the
 * most recent VISIBLE_DAYS days are shown by default, and the rest of the
 * fetched window is reachable by scrolling left. The inner chart gets a
 * fixed pixel width (days * DAY_WIDTH) inside an overflow-x-auto container,
 * and scroll position defaults to the far right (most recent day) on load.
 */
export function DealsPerDayChart({ data = [], isLoading, className, subtitle }) {
  const scrollRef = useRef(null);
  const isEmpty = !isLoading && data.every((d) => d.deals === 0);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [data]);

  const chartWidth = Math.max(data.length, VISIBLE_DAYS) * DAY_WIDTH;

  // `subtitle` names the window when the caller filtered to one; otherwise it is
  // the trailing window. The scroll hint is appended here rather than by the
  // caller because only this component knows how many days fit in the card -- a
  // filtered range can be shorter than VISIBLE_DAYS, with nothing to scroll to.
  const windowLabel = subtitle ?? `Last ${data.length} days`;
  const cardSubtitle =
    data.length > VISIBLE_DAYS ? `${windowLabel} — scroll left for earlier days` : windowLabel;

  return (
    <ChartCard
      title="Deals Created Per Day"
      subtitle={cardSubtitle}
      isLoading={isLoading}
      isEmpty={isEmpty}
      tableData={data}
      tableColumns={COLUMNS}
      className={className}
    >
      <div ref={scrollRef} className="scrollbar-thin h-full overflow-x-auto">
        <div style={{ width: chartWidth, height: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }} barSize={24}>
              <CartesianGrid {...chartGridProps} />
              <XAxis {...chartAxisProps('day')} interval={0} />
              <YAxis
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={40}
              />
              <Tooltip
                content={<ChartTooltip formatter={(value) => [value, 'deals']} />}
                cursor={{ fill: 'hsl(var(--muted))' }}
              />
              <Bar dataKey="deals" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ChartCard>
  );
}
