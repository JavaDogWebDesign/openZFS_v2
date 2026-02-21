import { useState } from 'react';
import { Camera, Trash2, RotateCcw, Copy, ChevronDown, ChevronRight } from 'lucide-react';
import type { Snapshot } from '@zfs-manager/shared';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/formatBytes';

interface SnapshotListProps {
  snapshots: Snapshot[];
  isLoading: boolean;
  onRollback?: (snapshot: Snapshot) => void;
  onClone?: (snapshot: Snapshot) => void;
  onDestroy?: (snapshot: Snapshot) => void;
}

/**
 * Group snapshots by their parent dataset.
 */
function groupByDataset(snapshots: Snapshot[]): Map<string, Snapshot[]> {
  const groups = new Map<string, Snapshot[]>();
  for (const snap of snapshots) {
    const existing = groups.get(snap.dataset) || [];
    existing.push(snap);
    groups.set(snap.dataset, existing);
  }
  return groups;
}

export function SnapshotList({
  snapshots,
  isLoading,
  onRollback,
  onClone,
  onDestroy,
}: SnapshotListProps) {
  const grouped = groupByDataset(snapshots);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
        <Camera className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium text-foreground">No snapshots</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a snapshot to preserve the current state of a dataset.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([dataset, snaps]) => (
        <DatasetSnapshotGroup
          key={dataset}
          dataset={dataset}
          snapshots={snaps}
          onRollback={onRollback}
          onClone={onClone}
          onDestroy={onDestroy}
        />
      ))}
    </div>
  );
}

function DatasetSnapshotGroup({
  dataset,
  snapshots,
  onRollback,
  onClone,
  onDestroy,
}: {
  dataset: string;
  snapshots: Snapshot[];
  onRollback?: (snapshot: Snapshot) => void;
  onClone?: (snapshot: Snapshot) => void;
  onDestroy?: (snapshot: Snapshot) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* Group header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between bg-muted/50 px-4 py-3 text-left hover:bg-muted/70 transition-colors"
      >
        <div className="flex items-center space-x-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <Camera className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-foreground">{dataset}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''}
        </span>
      </button>

      {/* Snapshot rows */}
      {expanded && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Created</th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">Used</th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">Referenced</th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((snap) => (
              <tr key={snap.name} className="border-b border-border last:border-0 hover:bg-muted/20">
                <td className="px-4 py-2">
                  <span className="font-medium text-foreground">@{snap.shortName}</span>
                  {snap.holds && snap.holds.length > 0 && (
                    <span className="ml-2 rounded bg-yellow-500/10 px-1.5 py-0.5 text-xs text-yellow-500">
                      held
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {new Date(snap.creation).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right text-foreground">{formatBytes(snap.used)}</td>
                <td className="px-4 py-2 text-right text-foreground">{formatBytes(snap.referenced)}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-end space-x-1">
                    <button
                      onClick={() => onRollback?.(snap)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      title="Rollback to this snapshot"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onClone?.(snap)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      title="Clone snapshot"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDestroy?.(snap)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Destroy snapshot"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
