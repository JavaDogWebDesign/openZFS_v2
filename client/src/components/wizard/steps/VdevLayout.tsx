import { useState, useMemo } from 'react';
import { RAID_LEVELS } from '@zfs-manager/shared';
import type { WizardState } from '../RaidWizard';
import { VdevVisualizer } from '../components/VdevVisualizer';
import { CapacityCalculator } from '../components/CapacityCalculator';

interface VdevLayoutProps {
  state: WizardState;
  onUpdate: (updates: Partial<WizardState>) => void;
}

export function VdevLayout({ state, onUpdate }: VdevLayoutProps) {
  const diskCount = state.selectedDisks.length;
  const raidLevel = RAID_LEVELS.find((l) => l.type === state.raidType);

  const maxVdevs = raidLevel ? Math.floor(diskCount / raidLevel.minDisks) : 1;
  const disksPerVdev = state.vdevCount > 0 ? Math.floor(diskCount / state.vdevCount) : diskCount;
  const remainderDisks = state.vdevCount > 0 ? diskCount % state.vdevCount : 0;

  // Generate vdev assignments
  const vdevAssignments = useMemo(() => {
    const assignments: Array<{ vdevIndex: number; disks: typeof state.selectedDisks }> = [];
    let offset = 0;
    for (let i = 0; i < state.vdevCount; i++) {
      const count = disksPerVdev + (i < remainderDisks ? 1 : 0);
      assignments.push({
        vdevIndex: i,
        disks: state.selectedDisks.slice(offset, offset + count),
      });
      offset += count;
    }
    return assignments;
  }, [state.selectedDisks, state.vdevCount, disksPerVdev, remainderDisks]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">VDEV Layout</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure how disks are distributed across VDEVs. More VDEVs increase performance but reduce
          per-vdev redundancy.
        </p>
      </div>

      {/* VDEV count selector */}
      <div className="rounded-lg border border-border bg-card p-4">
        <label className="block text-sm font-medium text-foreground mb-2">
          Number of Data VDEVs
        </label>
        <div className="flex items-center space-x-4">
          <input
            type="range"
            min={1}
            max={Math.max(1, maxVdevs)}
            value={state.vdevCount}
            onChange={(e) => onUpdate({ vdevCount: parseInt(e.target.value) })}
            className="flex-1"
          />
          <span className="w-8 text-center text-lg font-bold text-foreground">
            {state.vdevCount}
          </span>
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{disksPerVdev} disks per vdev</span>
          {remainderDisks > 0 && (
            <span className="text-yellow-500">{remainderDisks} disk(s) uneven distribution</span>
          )}
        </div>
      </div>

      {/* Capacity calculator */}
      <CapacityCalculator
        selectedDisks={state.selectedDisks}
        raidType={state.raidType}
        vdevCount={state.vdevCount}
      />

      {/* Visual layout */}
      <VdevVisualizer
        vdevAssignments={vdevAssignments}
        raidType={state.raidType}
      />
    </div>
  );
}
