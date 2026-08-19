/** Shared Recharts tooltip: value leads (strong), series name follows (secondary),
 * keyed with a short color stroke rather than a filled box. */
export function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-popover">
      {label && <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>}
      <div className="space-y-1">
        {payload.map((entry, index) => {
          const [value, name] = formatter ? formatter(entry.value, entry.name, entry) : [entry.value, entry.name];
          return (
            <div key={index} className="flex items-center gap-2 text-sm">
              <span
                className="h-0.5 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color || entry.fill }}
              />
              <span className="font-semibold text-popover-foreground">{value}</span>
              <span className="text-muted-foreground">{name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function chartAxisProps(dataKey) {
  return {
    dataKey,
    tick: { fill: 'hsl(var(--muted-foreground))', fontSize: 12 },
    tickLine: false,
    axisLine: { stroke: 'hsl(var(--border))' },
  };
}

export const chartGridProps = {
  stroke: 'hsl(var(--border))',
  strokeDasharray: 'none',
  vertical: false,
};

/** Truncates a category-axis label to one line; the full value stays
 * available via the tooltip (hover) and the table view. */
export function truncateLabel(value, maxLength = 18) {
  if (typeof value !== 'string' || value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}
