import { cn } from '@/utils/cn';

// A badge's color is driven by a *variant* (a reserved status-job token),
// not the raw label text -- so any status vocabulary (deal status, client
// lifecycle status, etc.) can reuse the same visual language by mapping its
// own labels to one of these variants.
const VARIANT_STYLES = {
  good: 'bg-status-good/10 text-status-good',
  critical: 'bg-status-critical/10 text-status-critical',
  warning: 'bg-status-warning/10 text-status-warning',
  primary: 'bg-primary/10 text-primary',
  muted: 'bg-muted text-muted-foreground',
};

// Deal status (Won/Lost/Active) is the original, most common caller -- keep
// its variant mapping as the default so existing callers don't need to pass
// `variant` explicitly.
const DEAL_STATUS_VARIANTS = {
  Won: 'good',
  Lost: 'critical',
  Active: 'primary',
};

export function StatusBadge({ status, variant, className }) {
  const resolvedVariant = variant || DEAL_STATUS_VARIANTS[status] || 'muted';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        VARIANT_STYLES[resolvedVariant],
        className
      )}
    >
      {status}
    </span>
  );
}
