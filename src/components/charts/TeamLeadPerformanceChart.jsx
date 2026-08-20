import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from 'recharts';
import { ChartCard } from '@/components/charts/ChartCard';
import { ChartTooltip, chartGridProps, truncateLabel } from '@/components/charts/ChartTooltip';
import { NO_TEAM_LEAD, TEAM_ADMIN, TEAM_INACTIVE } from '@/services/analyticsService';

// The catch-all rows are short strings we chose, not names off the roster, so
// they skip truncation entirely -- clipping "Inactive Users" to "Inactive Us…"
// hides nothing and just reads as a bug.
const BUCKET_LABELS = new Set([TEAM_ADMIN, TEAM_INACTIVE, NO_TEAM_LEAD]);

const COLUMNS = [
  { key: 'teamLead', label: 'Team Lead' },
  { key: 'total', label: 'Total' },
  { key: 'won', label: 'Closed' },
  { key: 'active', label: 'Active' },
  { key: 'lost', label: 'Axed' },
];

function renderLegend() {
  return (
    <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--status-good)' }} /> Closed
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--chart-1)' }} /> Active
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'var(--status-critical)' }} /> Axed
      </span>
    </div>
  );
}

/** Closed/Active/Axed are status meaning (pass/pending/fail), so they wear the
 * fixed status palette rather than generic categorical series colors. */
export function TeamLeadPerformanceChart({ data = [], isLoading, className }) {
  const isEmpty = !isLoading && data.length === 0;
  const rowHeight = 36;
  const height = Math.max(240, data.length * rowHeight);

  // Teams are few enough to name in the subtitle, and saying how many deals sit
  // outside them is the honest framing -- the catch-all row is large enough
  // that reading the bars without it would overstate every team's share.
  const teams = data.filter((row) => row.leadId !== null);
  // Summed, not found: the unled deals split across an Admin User, an Inactive
  // Users and a No Team Lead row, so taking the first would undercount badly.
  const unledDeals = data.reduce((sum, row) => (row.leadId === null ? sum + row.total : sum), 0);
  const totalDeals = data.reduce((sum, row) => sum + row.total, 0);
  const unledShare = totalDeals > 0 ? Math.round((unledDeals / totalDeals) * 100) : 0;

  return (
    <ChartCard
      title="Deals by Team Lead"
      subtitle={
        unledDeals > 0
          ? `${teams.length} teams; ${unledShare}% of deals sit outside one`
          : `Deal outcomes across ${teams.length} teams`
      }
      isLoading={isLoading}
      isEmpty={isEmpty}
      emptyMessage="No team leads are assigned in Bitrix yet"
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
            dataKey="teamLead"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={140}
            // 12, not the 14 the full-width associate chart uses: this card
            // sits in a half-width grid cell, where "Emmanuel Dominguez Amboya"
            // truncated at 14 is wide enough that recharts wraps it onto a
            // second line while its five neighbours stay on one.
            tickFormatter={(value) => (BUCKET_LABELS.has(value) ? value : truncateLabel(value, 12))}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
          <Legend content={renderLegend} />
          <Bar dataKey="won" name="Closed" stackId="status" fill="var(--status-good)" />
          <Bar dataKey="active" name="Active" stackId="status" fill="var(--chart-1)" />
          <Bar dataKey="lost" name="Axed" stackId="status" fill="var(--status-critical)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
