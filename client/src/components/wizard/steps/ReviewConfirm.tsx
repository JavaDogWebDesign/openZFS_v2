import { AlertTriangle, Database, HardDrive, Shield, Settings } from 'lucide-react';
import { RAID_LEVELS, calculateUsableCapacity } from '@zfs-manager/shared';
import { formatBytes } from '@/lib/formatBytes';
import type { WizardState } from '../RaidWizard';

interface ReviewConfirmProps {
  state: WizardState;
}

export function ReviewConfirm({ state }: ReviewConfirmProps) {
  const raidLevel = RAID_LEVELS.find((l) => l.type === state.raidType);
  const totalRawSize = state.selectedDisks.reduce((sum, d) => sum + d.size, 0);
  const smallestDisk = Math.min(...state.selectedDisks.map((d) => d.size));
  const disksPerVdev = Math.floor(state.selectedDisks.length / state.vdevCount);

  const usablePerVdev = calculateUsableCapacity(smallestDisk, disksPerVdev, state.raidType);
  const totalUsable = usablePerVdev * state.vdevCount;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Review Configuration</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Please review your pool configuration before creating.
        </p>
      </div>

      {/* Warning */}
      <div className="flex items-start space-x-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
        <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-yellow-500">Data Loss Warning</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Creating this pool will erase all data on the selected disks.
            This operation cannot be undone.
          </p>
        </div>
      </div>

      {/* Pool info */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="flex items-center space-x-2">
          <Database className="h-5 w-5 text-primary" />
          <h4 className="font-semibold text-card-foreground">Pool: {state.poolName}</h4>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <ReviewItem label="RAID Type" value={raidLevel?.label ?? state.raidType} />
          <ReviewItem label="VDEVs" value={String(state.vdevCount)} />
          <ReviewItem label="Disks per VDEV" value={String(disksPerVdev)} />
          <ReviewItem label="Total Disks" value={String(state.selectedDisks.length)} />
          <ReviewItem label="Ashift" value={state.ashift === '0' ? 'Auto' : state.ashift} />
          <ReviewItem label="Compression" value={state.compression} />
        </div>
      </div>

      {/* Capacity */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center space-x-2">
          <HardDrive className="h-5 w-5 text-primary" />
          <h4 className="font-semibold text-card-foreground">Capacity</h4>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <ReviewItem label="Raw Capacity" value={formatBytes(totalRawSize)} />
          <ReviewItem label="Usable Capacity (est.)" value={formatBytes(totalUsable)} />
          <ReviewItem
            label="Overhead"
            value={`${((1 - totalUsable / totalRawSize) * 100).toFixed(1)}%`}
          />
          <ReviewItem
            label="Redundancy"
            value={
              raidLevel?.parityDisks
                ? `${raidLevel.parityDisks} parity disk(s) per vdev`
                : state.raidType === 'mirror'
                  ? 'Full mirror'
                  : 'None'
            }
          />
        </div>
      </div>

      {/* Disks */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center space-x-2">
          <Shield className="h-5 w-5 text-primary" />
          <h4 className="font-semibold text-card-foreground">Selected Disks</h4>
        </div>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {state.selectedDisks.map((disk) => (
            <div
              key={disk.name}
              className="flex items-center justify-between rounded bg-muted/50 px-3 py-1.5 text-xs"
            >
              <span className="font-medium text-foreground">{disk.name}</span>
              <div className="flex items-center space-x-2 text-muted-foreground">
                <span>{disk.model}</span>
                <span>{formatBytes(disk.size)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dataset */}
      {state.datasetName && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center space-x-2">
            <Settings className="h-5 w-5 text-primary" />
            <h4 className="font-semibold text-card-foreground">Initial Dataset</h4>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <ReviewItem label="Name" value={`${state.poolName}/${state.datasetName}`} />
            <ReviewItem label="Compression" value={state.datasetCompression} />
            {state.datasetQuota && <ReviewItem label="Quota" value={state.datasetQuota} />}
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}
