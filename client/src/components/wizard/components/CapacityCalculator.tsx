import { Calculator } from 'lucide-react';
import type { Disk } from '@zfs-manager/shared';
import { calculateUsableCapacity, RAID_LEVELS } from '@zfs-manager/shared';
import { formatBytes } from '@/lib/formatBytes';
import { cn } from '@/lib/utils';

interface CapacityCalculatorProps {
  selectedDisks: Disk[];
  raidType: string;
  vdevCount: number;
}

export function CapacityCalculator({ selectedDisks, raidType, vdevCount }: CapacityCalculatorProps) {
  const diskCount = selectedDisks.length;
  const raidLevel = RAID_LEVELS.find((l) => l.type === raidType);

  if (diskCount === 0) {
    return null;
  }

  const totalRawSize = selectedDisks.reduce((sum, d) => sum + d.size, 0);
  const smallestDisk = Math.min(...selectedDisks.map((d) => d.size));
  const largestDisk = Math.max(...selectedDisks.map((d) => d.size));
  const disksPerVdev = Math.floor(diskCount / vdevCount);

  // ZFS uses the smallest disk size in each vdev
  const usablePerVdev = calculateUsableCapacity(smallestDisk, disksPerVdev, raidType);
  const totalUsable = usablePerVdev * vdevCount;
  const overhead = totalRawSize - totalUsable;
  const overheadPercent = totalRawSize > 0 ? (overhead / totalRawSize) * 100 : 0;
  const efficiency = totalRawSize > 0 ? (totalUsable / totalRawSize) * 100 : 0;

  const hasMixedSizes = smallestDisk !== largestDisk;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center space-x-2">
        <Calculator className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-medium text-foreground">Estimated Capacity</h4>
      </div>

      {hasMixedSizes && (
        <div className="rounded bg-yellow-500/10 px-3 py-2 text-xs text-yellow-500">
          Mixed disk sizes detected. ZFS will use the smallest disk size ({formatBytes(smallestDisk)}) for calculations.
          Larger disks will have wasted space.
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <CapacityItem label="Raw Capacity" value={formatBytes(totalRawSize)} />
        <CapacityItem
          label="Usable Capacity"
          value={formatBytes(totalUsable)}
          highlight
        />
        <CapacityItem label="Parity Overhead" value={formatBytes(overhead)} />
      </div>

      {/* Visual bar */}
      <div>
        <div className="flex items-center justify-between mb-1 text-xs text-muted-foreground">
          <span>Storage Efficiency</span>
          <span>{efficiency.toFixed(1)}%</span>
        </div>
        <div className="h-4 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-4 rounded-full transition-all',
              efficiency > 75
                ? 'bg-emerald-500'
                : efficiency > 50
                  ? 'bg-yellow-500'
                  : 'bg-red-500',
            )}
            style={{ width: `${Math.min(efficiency, 100)}%` }}
          />
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        <p>
          {vdevCount} x {raidLevel?.label ?? raidType} with {disksPerVdev} disks each
          {raidLevel?.parityDisks
            ? ` (${raidLevel.parityDisks} parity per vdev)`
            : raidType === 'mirror'
              ? ' (mirrored)'
              : ''}
        </p>
      </div>
    </div>
  );
}

function CapacityItem({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-bold', highlight ? 'text-primary' : 'text-foreground')}>
        {value}
      </p>
    </div>
  );
}
