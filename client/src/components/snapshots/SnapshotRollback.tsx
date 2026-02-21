import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Snapshot } from '@zfs-manager/shared';
import { snapshotApi } from '@/api/endpoints';

interface SnapshotRollbackProps {
  open: boolean;
  snapshot: Snapshot | null;
  onClose: () => void;
  onConfirm: (snapshot: Snapshot, destroyMoreRecent: boolean) => void;
}

export function SnapshotRollback({ open, snapshot, onClose, onConfirm }: SnapshotRollbackProps) {
  const [destroyMoreRecent, setDestroyMoreRecent] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open || !snapshot) return null;

  const isConfirmed = confirmText === snapshot.shortName;

  const handleConfirm = async () => {
    if (!isConfirmed) return;
    setIsSubmitting(true);
    try {
      const result = await snapshotApi.rollback(snapshot.name, { destroyMoreRecent });
      if (result.success) {
        onConfirm(snapshot, destroyMoreRecent);
      }
    } catch {
      // Error handled by API client
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-50 w-full max-w-md rounded-lg border border-border bg-card shadow-lg animate-fade-in">
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h2 className="text-lg font-semibold text-card-foreground">Rollback Snapshot</h2>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
            <p className="text-sm font-medium text-destructive">Warning: This is a destructive operation</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>All data written after the snapshot will be permanently lost</li>
              <li>Any snapshots more recent than this one may need to be destroyed</li>
              <li>This operation cannot be undone</li>
            </ul>
          </div>

          <div>
            <p className="text-sm text-foreground">
              Rolling back dataset <span className="font-semibold">{snapshot.dataset}</span> to
              snapshot <span className="font-semibold">@{snapshot.shortName}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Created: {new Date(snapshot.creation).toLocaleString()}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="destroyMoreRecent"
              checked={destroyMoreRecent}
              onChange={(e) => setDestroyMoreRecent(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <label htmlFor="destroyMoreRecent" className="text-sm text-foreground">
              Destroy more recent snapshots
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Type <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{snapshot.shortName}</code> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={snapshot.shortName}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!isConfirmed || isSubmitting}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Rolling back...' : 'Rollback'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
