import { HardDrive, Shield } from 'lucide-react';
import type { Disk } from '@zfs-manager/shared';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/formatBytes';

interface VdevAssignment {
  vdevIndex: number;
  disks: Disk[];
}

interface VdevVisualizerProps {
  vdevAssignments: VdevAssignment[];
  raidType: string;
}

export function VdevVisualizer({ vdevAssignments, raidType }: VdevVisualizerProps) {
  if (vdevAssignments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">No VDEVs configured</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-foreground">VDEV Layout Preview</h4>

      <div className="space-y-3">
        {vdevAssignments.map((vdev) => (
          <div
            key={vdev.vdevIndex}
            className="rounded-lg border border-border bg-card p-4"
          >
            {/* VDEV header */}
            <div className="flex items-center space-x-2 mb-3">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-card-foreground">
                VDEV {vdev.vdevIndex}
              </span>
              <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {raidType}
              </span>
              <span className="text-xs text-muted-foreground">
                ({vdev.disks.length} disks)
              </span>
            </div>

            {/* Disk chips */}
            <div className="flex flex-wrap gap-2">
              {vdev.disks.map((disk) => (
                <div
                  key={disk.name}
                  className={cn(
                    'flex items-center space-x-2 rounded-md border border-border bg-muted/50 px-3 py-2',
                  )}
                >
                  <HardDrive className="h-3 w-3 text-muted-foreground" />
                  <div className="text-xs">
                    <span className="font-medium text-foreground">{disk.name}</span>
                    <span className="ml-2 text-muted-foreground">{formatBytes(disk.size)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Pool topology text representation */}
      <div className="rounded-lg bg-zinc-950 p-4 font-mono text-xs text-zinc-300">
        <p className="text-zinc-500 mb-1"># Pool topology preview</p>
        <p>pool: (name pending)</p>
        {vdevAssignments.map((vdev) => (
          <div key={vdev.vdevIndex} className="ml-4">
            <p className="text-blue-400">
              {raidType}-{vdev.vdevIndex}
            </p>
            {vdev.disks.map((disk) => (
              <p key={disk.name} className="ml-4 text-zinc-400">
                {disk.path || disk.name}
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
