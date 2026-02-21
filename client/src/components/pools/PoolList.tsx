import { useNavigate } from 'react-router-dom';
import { Database, MoreVertical, Trash2, Download, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatBytes } from '@/lib/formatBytes';
import type { Pool } from '@zfs-manager/shared';

interface PoolListProps {
  pools: Pool[];
  isLoading: boolean;
  onExport?: (name: string) => void;
  onDestroy?: (name: string) => void;
}

export function PoolList({ pools, isLoading, onExport, onDestroy }: PoolListProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border border-border bg-card"
          />
        ))}
      </div>
    );
  }

  if (pools.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
        <Database className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium text-foreground">No pools found</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a new pool or import an existing one to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Size</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Used</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Capacity</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fragmentation</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {pools.map((pool) => (
            <tr
              key={pool.name}
              className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => navigate(`/pools/${pool.name}`)}
            >
              <td className="px-4 py-3">
                <div className="flex items-center space-x-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">{pool.name}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={pool.status} />
              </td>
              <td className="px-4 py-3 text-foreground">{formatBytes(pool.size)}</td>
              <td className="px-4 py-3 text-foreground">{formatBytes(pool.allocated)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center space-x-3">
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className={cn(
                          'h-2 rounded-full transition-all',
                          pool.capacity > 90
                            ? 'bg-red-500'
                            : pool.capacity > 75
                              ? 'bg-yellow-500'
                              : 'bg-emerald-500',
                        )}
                        style={{ width: `${Math.min(pool.capacity, 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-10 text-right text-xs text-muted-foreground">
                    {pool.capacity}%
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{pool.fragmentation}%</td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end space-x-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onExport?.(pool.name)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    title="Export pool"
                  >
                    <Upload className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDestroy?.(pool.name)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Destroy pool"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
