import { BarChart3 } from 'lucide-react';
import { cn } from '@/utils/cn';

export function NoDataCard({ message = 'No data available', className, height = 'h-full' }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 text-muted-foreground', height, className)}>
      <BarChart3 className="h-6 w-6 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
