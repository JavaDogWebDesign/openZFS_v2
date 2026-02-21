import { HardDrive, Check } from 'lucide-react';
import type { Disk } from '@zfs-manager/shared';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/formatBytes';
import { DriveHealth } from '@/components/drives/DriveHealth';

interface DiskCardProps {
  disk: Disk;
  selected: boolean;
  onToggle: () => void;
}

export function DiskCard({ disk, selected, onToggle }: DiskCardProps) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'relative flex flex-col rounded-lg border p-3 text-left transition-all',
        selected
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'border-border hover:border-primary/50 hover:bg-muted/30',
      )}
    >
      {/* Selection indicator */}
      {selected && (
        <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
          <Check className="h-3 w-3 text-primary-foreground" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center space-x-2">
        <HardDrive className={cn('h-5 w-5', selected ? 'text-primary' : 'text-muted-foreground')} />
        <span className="font-medium text-foreground text-sm">{disk.name}</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {disk.type.toUpperCase()}
        </span>
      </div>

      {/* Model */}
      <p className="mt-1 text-xs text-muted-foreground truncate">{disk.model || 'Unknown model'}</p>

      {/* Details */}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{formatBytes(disk.size)}</span>
        <DriveHealth health={disk.health} size="sm" />
      </div>

      {/* Serial */}
      <p className="mt-1 font-mono text-[10px] text-muted-foreground truncate">
        S/N: {disk.serial || 'N/A'}
      </p>
    </button>
  );
}
