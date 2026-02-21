import { useState } from 'react';
import { Share2, Trash2, Edit, ToggleLeft, ToggleRight } from 'lucide-react';
import type { SMBShare, NFSShare } from '@zfs-manager/shared';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/common/StatusBadge';

interface ShareListProps {
  smbShares: SMBShare[];
  nfsShares: NFSShare[];
  isLoading: boolean;
  onEditSmb?: (share: SMBShare) => void;
  onDeleteSmb?: (name: string) => void;
  onEditNfs?: (share: NFSShare) => void;
  onDeleteNfs?: (path: string) => void;
}

type Tab = 'smb' | 'nfs';

export function ShareList({
  smbShares,
  nfsShares,
  isLoading,
  onEditSmb,
  onDeleteSmb,
  onEditNfs,
  onDeleteNfs,
}: ShareListProps) {
  const [activeTab, setActiveTab] = useState<Tab>('smb');

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-10 w-48 animate-pulse rounded bg-muted" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab selector */}
      <div className="flex space-x-1 rounded-lg border border-border p-1 w-fit">
        <button
          onClick={() => setActiveTab('smb')}
          className={cn(
            'rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'smb'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          SMB Shares ({smbShares.length})
        </button>
        <button
          onClick={() => setActiveTab('nfs')}
          className={cn(
            'rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'nfs'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          NFS Exports ({nfsShares.length})
        </button>
      </div>

      {/* SMB table */}
      {activeTab === 'smb' && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Path</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Comment</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Browseable</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Read Only</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Guest</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {smbShares.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    No SMB shares configured
                  </td>
                </tr>
              ) : (
                smbShares.map((share) => (
                  <tr key={share.name} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{share.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{share.path}</td>
                    <td className="px-4 py-3 text-muted-foreground">{share.comment || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      {share.browseable ? <ToggleRight className="inline h-4 w-4 text-emerald-500" /> : <ToggleLeft className="inline h-4 w-4 text-muted-foreground" />}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {share.readonly ? <ToggleRight className="inline h-4 w-4 text-yellow-500" /> : <ToggleLeft className="inline h-4 w-4 text-muted-foreground" />}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {share.guestOk ? <ToggleRight className="inline h-4 w-4 text-yellow-500" /> : <ToggleLeft className="inline h-4 w-4 text-muted-foreground" />}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={share.enabled ? 'ONLINE' : 'OFFLINE'} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => onEditSmb?.(share)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDeleteSmb?.(share.name)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* NFS table */}
      {activeTab === 'nfs' && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Path</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Access Rules</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Comment</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {nfsShares.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    No NFS exports configured
                  </td>
                </tr>
              ) : (
                nfsShares.map((share) => (
                  <tr key={share.path} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{share.path}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {share.rules.map((rule, idx) => (
                          <span key={idx} className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {rule.host} ({rule.options.join(',')})
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{share.comment || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={share.enabled ? 'ONLINE' : 'OFFLINE'} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          onClick={() => onEditNfs?.(share)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDeleteNfs?.(share.path)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
