import { useState } from 'react';
import { X, Copy } from 'lucide-react';
import type { Snapshot } from '@zfs-manager/shared';
import { snapshotApi } from '@/api/endpoints';

interface SnapshotCloneProps {
  open: boolean;
  snapshot: Snapshot | null;
  onClose: () => void;
  onCloned: () => void;
}

export function SnapshotClone({ open, snapshot, onClose, onCloned }: SnapshotCloneProps) {
  const [cloneName, setCloneName] = useState('');
  const [mountpoint, setMountpoint] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open || !snapshot) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await snapshotApi.clone(
        snapshot.name,
        cloneName,
        { mountpoint: mountpoint || undefined },
      );
      if (result.success) {
        onCloned();
        onClose();
      }
    } catch {
      // Error handled by API client
    } finally {
      setIsSubmitting(false);
    }
  };

  // Derive default clone name from snapshot
  const pool = snapshot.dataset.split('/')[0];
  const defaultCloneName = `${pool}/${snapshot.shortName}-clone`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-50 w-full max-w-md rounded-lg border border-border bg-card shadow-lg animate-fade-in">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center space-x-2">
            <Copy className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-card-foreground">Clone Snapshot</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Source info */}
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Source Snapshot</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">{snapshot.name}</p>
          </div>

          {/* Clone name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Clone Name</label>
            <input
              type="text"
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              placeholder={defaultCloneName}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Full dataset path for the clone (e.g., pool/clone-name)
            </p>
          </div>

          {/* Mountpoint */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Mountpoint <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={mountpoint}
              onChange={(e) => setMountpoint(e.target.value)}
              placeholder="Auto-generated if left empty"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3">
            <p className="text-xs text-blue-500">
              Cloning a snapshot creates a new writable dataset that initially shares blocks
              with the original. Space is only consumed as data diverges from the original.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!cloneName || isSubmitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Cloning...' : 'Clone Snapshot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
