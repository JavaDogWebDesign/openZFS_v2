import { useState } from 'react';
import { X, Camera } from 'lucide-react';
import { snapshotApi } from '@/api/endpoints';

interface SnapshotCreateProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  datasets?: string[];
}

export function SnapshotCreate({ open, onClose, onCreated, datasets = [] }: SnapshotCreateProps) {
  const [dataset, setDataset] = useState(datasets[0] ?? '');
  const [name, setName] = useState('');
  const [recursive, setRecursive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await snapshotApi.create({ dataset, name, recursive });
      if (result.success) {
        onCreated();
        onClose();
      }
    } catch {
      // Error handled by API client
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateName = () => {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    setName(`manual-${timestamp}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-50 w-full max-w-md rounded-lg border border-border bg-card shadow-lg animate-fade-in">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center space-x-2">
            <Camera className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-card-foreground">Create Snapshot</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Dataset selector */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Dataset</label>
            <select
              value={dataset}
              onChange={(e) => setDataset(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select a dataset...</option>
              {datasets.map((ds) => (
                <option key={ds} value={ds}>{ds}</option>
              ))}
            </select>
          </div>

          {/* Snapshot name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Snapshot Name</label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="snapshot-name"
                required
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                onClick={generateName}
                className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent transition-colors"
              >
                Auto
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Full name: {dataset}@{name || '<name>'}
            </p>
          </div>

          {/* Recursive */}
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="recursive"
              checked={recursive}
              onChange={(e) => setRecursive(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <label htmlFor="recursive" className="text-sm text-foreground">
              Recursive (include child datasets)
            </label>
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
              disabled={!dataset || !name || isSubmitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create Snapshot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
