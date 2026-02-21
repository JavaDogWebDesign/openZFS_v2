import { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import type { Snapshot } from '@zfs-manager/shared';
import { snapshotApi, datasetApi } from '@/api/endpoints';
import { SnapshotList } from '@/components/snapshots/SnapshotList';
import { SnapshotCreate } from '@/components/snapshots/SnapshotCreate';
import { SnapshotRollback } from '@/components/snapshots/SnapshotRollback';
import { SnapshotClone } from '@/components/snapshots/SnapshotClone';
import { useConfirm } from '@/hooks/useConfirm';

export function SnapshotsPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [datasets, setDatasets] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [rollbackSnapshot, setRollbackSnapshot] = useState<Snapshot | null>(null);
  const [cloneSnapshot, setCloneSnapshot] = useState<Snapshot | null>(null);
  const { confirm } = useConfirm();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const [snapshotResult, datasetResult] = await Promise.all([
      snapshotApi.list(),
      datasetApi.list(),
    ]);
    if (snapshotResult.success) {
      setSnapshots(snapshotResult.data);
    }
    if (datasetResult.success) {
      setDatasets(datasetResult.data.map((d) => d.name));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = () => {
    fetchData();
  };

  const handleDestroy = async (snapshot: Snapshot) => {
    const confirmed = await confirm({
      title: 'Destroy Snapshot',
      description: `Are you sure you want to destroy snapshot "${snapshot.name}"? This cannot be undone.`,
      confirmLabel: 'Destroy',
      destructive: true,
    });
    if (confirmed) {
      const result = await snapshotApi.destroy(snapshot.name);
      if (result.success) {
        refetch();
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Snapshots</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, manage, and restore ZFS snapshots
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center space-x-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Create Snapshot</span>
        </button>
      </div>

      <SnapshotList
        snapshots={snapshots}
        isLoading={isLoading}
        onRollback={(snap) => setRollbackSnapshot(snap)}
        onClone={(snap) => setCloneSnapshot(snap)}
        onDestroy={handleDestroy}
      />

      <SnapshotCreate
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={refetch}
        datasets={datasets}
      />

      <SnapshotRollback
        open={!!rollbackSnapshot}
        snapshot={rollbackSnapshot}
        onClose={() => setRollbackSnapshot(null)}
        onConfirm={() => {
          setRollbackSnapshot(null);
          refetch();
        }}
      />

      <SnapshotClone
        open={!!cloneSnapshot}
        snapshot={cloneSnapshot}
        onClose={() => setCloneSnapshot(null)}
        onCloned={refetch}
      />
    </div>
  );
}
