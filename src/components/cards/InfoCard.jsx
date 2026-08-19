import { cn } from '@/utils/cn';

export function InfoCard({ title, subtitle, actions, children, className, contentClassName, footer }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card shadow-card', className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            {title && <h3 className="truncate text-base font-semibold text-card-foreground">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn('p-5', contentClassName)}>{children}</div>
      {footer && <div className="border-t border-border px-5 py-3">{footer}</div>}
    </div>
  );
}
