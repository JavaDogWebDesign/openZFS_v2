import { useState } from 'react';
import { Plus, Download } from 'lucide-react';
import { usePools } from '@/hooks/useZfsPool';
import { poolApi } from '@/api/endpoints';
import { PoolList } from '@/components/pools/PoolList';
import { PoolCreateWizard } from '@/components/pools/PoolCreateWizard';
import { useConfirm } from '@/hooks/useConfirm';

export function PoolsPage() {
  const { pools, isLoading, refetch } = usePools();
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const { confirm } = useConfirm();

  const handleExport = async (name: string) => {
    const confirmed = await confirm({
      title: 'Export Pool',
      description: `Are you sure you want to export pool "${name}"? The pool will be unavailable until re-imported.`,
      confirmLabel: 'Export',
    });
    if (confirmed) {
      const result = await poolApi.exportPool(name);
      if (result.success) {
        refetch();
      }
    }
  };

  const handleDestroy = async (name: string) => {
    const confirmed = await confirm({
      title: 'Destroy Pool',
      description: `Are you sure you want to destroy pool "${name}"? ALL DATA WILL BE PERMANENTLY LOST. This cannot be undone.`,
      confirmLabel: 'Destroy Pool',
      destructive: true,
    });
    if (confirmed) {
      const result = await poolApi.destroy(name);
      if (result.success) {
        refetch();
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Storage Pools</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage ZFS storage pools and their configurations
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            className="flex items-center space-x-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Import Pool</span>
          </button>
          <button
            onClick={() => setShowCreateWizard(true)}
            className="flex items-center space-x-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Create Pool</span>
          </button>
        </div>
      </div>

      <PoolList
        pools={pools}
        isLoading={isLoading}
        onExport={handleExport}
        onDestroy={handleDestroy}
      />

      <PoolCreateWizard
        open={showCreateWizard}
        onClose={() => setShowCreateWizard(false)}
        onCreated={refetch}
      />
    </div>
  );
}
