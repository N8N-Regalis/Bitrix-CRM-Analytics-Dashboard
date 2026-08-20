import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

export function formatCurrency(amount, currency = 'USD') {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);
  }
}

export function formatCompactNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatPercent(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

/** First + last initial, for avatar fallbacks. Empty string when unnameable. */
export function formatInitials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return letters.toUpperCase();
}

export function formatDate(dateInput, pattern = 'MMM d, yyyy') {
  if (!dateInput) return 'N/A';
  const date = new Date(dateInput);
  if (!isValid(date)) return 'N/A';
  return format(date, pattern);
}

/**
 * A calendar day with no time attached ('2024-11-28', as Postgres `date`
 * columns come back over PostgREST) — not the same job as formatDate above.
 *
 * `new Date('2024-11-28')` anchors a date-only string to UTC midnight, which
 * date-fns then renders in the reader's zone: the 27th for anyone west of
 * Greenwich, i.e. most of this dashboard's audience. parseISO reads a bare date
 * as local midnight instead, so the day survives the round trip. Returns '—'
 * rather than formatDate's 'N/A' to match the numeric formatters it sits
 * beside in a table row.
 */
export function formatDateOnly(dateInput, pattern = 'MMM d, yyyy') {
  if (!dateInput) return '—';
  const date = parseISO(String(dateInput));
  if (!isValid(date)) return '—';
  return format(date, pattern);
}

export function formatRelativeTime(dateInput) {
  if (!dateInput) return 'N/A';
  const date = new Date(dateInput);
  if (!isValid(date)) return 'N/A';
  return formatDistanceToNow(date, { addSuffix: true });
}

/** Duration expressed in days (as stored in stage_transitions.duration_days),
 * scaled to whichever unit reads most naturally at that magnitude. */
export function formatDuration(days) {
  if (days === null || days === undefined || Number.isNaN(days)) return '—';
  const hours = days * 24;
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (days < 1) return `${hours.toFixed(1)}h`;
  if (days < 30) return `${days.toFixed(1)}d`;
  return `${(days / 30).toFixed(1)}mo`;
}
