import { cn } from '@/lib/utils';

type StatusVariant =
  | 'ONLINE'
  | 'DEGRADED'
  | 'FAULTED'
  | 'OFFLINE'
  | 'UNAVAIL'
  | 'REMOVED'
  | 'running'
  | 'finished'
  | 'canceled'
  | 'none'
  | 'suspended'
  | 'info'
  | 'warning'
  | 'error'
  | 'critical'
  | 'success'
  | string;

const variantStyles: Record<string, string> = {
  ONLINE: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20',
  DEGRADED: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/20',
  FAULTED: 'bg-red-500/15 text-red-500 border-red-500/20',
  OFFLINE: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
  UNAVAIL: 'bg-red-500/15 text-red-400 border-red-500/20',
  REMOVED: 'bg-zinc-500/15 text-zinc-500 border-zinc-500/20',
  running: 'bg-blue-500/15 text-blue-500 border-blue-500/20',
  finished: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20',
  canceled: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
  none: 'bg-zinc-500/15 text-zinc-500 border-zinc-500/20',
  suspended: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/20',
  info: 'bg-blue-500/15 text-blue-500 border-blue-500/20',
  warning: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/20',
  error: 'bg-red-500/15 text-red-500 border-red-500/20',
  critical: 'bg-red-600/15 text-red-400 border-red-600/20',
  success: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20',
};

const defaultStyle = 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20';

interface StatusBadgeProps {
  status: StatusVariant;
  className?: string;
  showDot?: boolean;
}

export function StatusBadge({ status, className, showDot = true }: StatusBadgeProps) {
  const style = variantStyles[status] ?? defaultStyle;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        style,
        className,
      )}
    >
      {showDot && (
        <span
          className={cn(
            'mr-1.5 h-1.5 w-1.5 rounded-full',
            status === 'ONLINE' || status === 'finished' || status === 'success'
              ? 'bg-emerald-500'
              : status === 'DEGRADED' || status === 'warning' || status === 'suspended'
                ? 'bg-yellow-500'
                : status === 'FAULTED' || status === 'error' || status === 'critical'
                  ? 'bg-red-500'
                  : status === 'running' || status === 'info'
                    ? 'bg-blue-500'
                    : 'bg-zinc-500',
          )}
        />
      )}
      {status}
    </span>
  );
}
