import { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import type { SMBShare, NFSShare } from '@zfs-manager/shared';
import { shareApi } from '@/api/endpoints';
import { ShareList } from '@/components/shares/ShareList';
import { SMBShareForm } from '@/components/shares/SMBShareForm';
import { NFSShareForm } from '@/components/shares/NFSShareForm';
import { useConfirm } from '@/hooks/useConfirm';

export function SharesPage() {
  const [smbShares, setSmbShares] = useState<SMBShare[]>([]);
  const [nfsShares, setNfsShares] = useState<NFSShare[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSmbForm, setShowSmbForm] = useState(false);
  const [showNfsForm, setShowNfsForm] = useState(false);
  const [editingSmb, setEditingSmb] = useState<SMBShare | null>(null);
  const [editingNfs, setEditingNfs] = useState<NFSShare | null>(null);
  const { confirm } = useConfirm();

  const fetchShares = useCallback(async () => {
    setIsLoading(true);
    const [smbResult, nfsResult] = await Promise.all([
      shareApi.listSmb(),
      shareApi.listNfs(),
    ]);
    if (smbResult.success) {
      setSmbShares(smbResult.data);
    }
    if (nfsResult.success) {
      setNfsShares(nfsResult.data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  const refetch = () => {
    fetchShares();
  };

  const handleDeleteSmb = async (name: string) => {
    const confirmed = await confirm({
      title: 'Delete SMB Share',
      description: `Are you sure you want to delete SMB share "${name}"?`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (confirmed) {
      const result = await shareApi.deleteSmb(name);
      if (result.success) {
        refetch();
      }
    }
  };

  const handleDeleteNfs = async (path: string) => {
    const confirmed = await confirm({
      title: 'Delete NFS Export',
      description: `Are you sure you want to delete NFS export "${path}"?`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (confirmed) {
      const result = await shareApi.deleteNfs(path);
      if (result.success) {
        refetch();
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Network Shares</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure SMB (Samba) and NFS file shares
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowNfsForm(true)}
            className="flex items-center space-x-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>New NFS Export</span>
          </button>
          <button
            onClick={() => setShowSmbForm(true)}
            className="flex items-center space-x-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>New SMB Share</span>
          </button>
        </div>
      </div>

      <ShareList
        smbShares={smbShares}
        nfsShares={nfsShares}
        isLoading={isLoading}
        onEditSmb={(share) => {
          setEditingSmb(share);
          setShowSmbForm(true);
        }}
        onDeleteSmb={handleDeleteSmb}
        onEditNfs={(share) => {
          setEditingNfs(share);
          setShowNfsForm(true);
        }}
        onDeleteNfs={handleDeleteNfs}
      />

      <SMBShareForm
        open={showSmbForm}
        share={editingSmb}
        onClose={() => {
          setShowSmbForm(false);
          setEditingSmb(null);
        }}
        onSaved={refetch}
      />

      <NFSShareForm
        open={showNfsForm}
        share={editingNfs}
        onClose={() => {
          setShowNfsForm(false);
          setEditingNfs(null);
        }}
        onSaved={refetch}
      />
    </div>
  );
}
