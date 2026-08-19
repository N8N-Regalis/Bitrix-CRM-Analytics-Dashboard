import { cn } from '@/utils/cn';

export function PageContainer({ title, subtitle, actions, children, className }) {
  return (
    <div className="w-full">
      <div className="flex flex-col gap-3 px-4 pb-4 pt-6 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className={cn('px-4 pb-6 sm:px-6', className)}>{children}</div>
    </div>
  );
}
