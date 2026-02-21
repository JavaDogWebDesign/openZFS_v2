import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DriveHealthProps {
  health?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function DriveHealth({ health, size = 'sm' }: DriveHealthProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const iconClass = sizeClasses[size];

  if (!health) {
    return (
      <div className="flex items-center space-x-1.5">
        <HelpCircle className={cn(iconClass, 'text-zinc-500')} />
        {size !== 'sm' && <span className="text-sm text-zinc-500">Unknown</span>}
      </div>
    );
  }

  const normalizedHealth = health.toUpperCase();

  if (normalizedHealth === 'PASSED' || normalizedHealth === 'OK' || normalizedHealth === 'ONLINE') {
    return (
      <div className="flex items-center space-x-1.5">
        <CheckCircle2 className={cn(iconClass, 'text-emerald-500')} />
        {size !== 'sm' && <span className="text-sm text-emerald-500">Healthy</span>}
      </div>
    );
  }

  if (normalizedHealth === 'DEGRADED' || normalizedHealth === 'WARNING') {
    return (
      <div className="flex items-center space-x-1.5">
        <AlertTriangle className={cn(iconClass, 'text-yellow-500')} />
        {size !== 'sm' && <span className="text-sm text-yellow-500">Degraded</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-1.5">
      <XCircle className={cn(iconClass, 'text-red-500')} />
      {size !== 'sm' && <span className="text-sm text-red-500">Failed</span>}
    </div>
  );
}
