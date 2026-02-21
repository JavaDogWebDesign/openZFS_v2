import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { datasetApi } from '@/api/endpoints';

interface DatasetCreateProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  parentDatasets?: string[];
}

export function DatasetCreate({ open, onClose, onCreated, parentDatasets = [] }: DatasetCreateProps) {
  const [name, setName] = useState('');
  const [parent, setParent] = useState(parentDatasets[0] ?? '');
  const [compression, setCompression] = useState('lz4');
  const [quota, setQuota] = useState('');
  const [recordsize, setRecordsize] = useState('128K');
  const [atime, setAtime] = useState('off');
  const [mountpoint, setMountpoint] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const properties: Record<string, string> = { compression, recordsize, atime };
      if (quota) properties.quota = quota;
      if (mountpoint) properties.mountpoint = mountpoint;

      const result = await datasetApi.create({
        name: `${parent}/${name}`,
        properties,
      });

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-50 w-full max-w-lg rounded-lg border border-border bg-card shadow-lg animate-fade-in">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-card-foreground">Create Dataset</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Parent */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Parent Dataset</label>
            <select
              value={parent}
              onChange={(e) => setParent(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {parentDatasets.map((ds) => (
                <option key={ds} value={ds}>{ds}</option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Dataset Name</label>
            <div className="flex items-center space-x-1">
              <span className="text-sm text-muted-foreground">{parent}/</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-dataset"
                required
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* Compression */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Compression</label>
            <select
              value={compression}
              onChange={(e) => setCompression(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="off">Off</option>
              <option value="on">On (default)</option>
              <option value="lz4">LZ4 (recommended)</option>
              <option value="gzip">GZIP</option>
              <option value="zstd">ZSTD</option>
              <option value="zle">ZLE</option>
              <option value="lzjb">LZJB</option>
            </select>
          </div>

          {/* Record Size */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Record Size</label>
            <select
              value={recordsize}
              onChange={(e) => setRecordsize(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="4K">4K</option>
              <option value="8K">8K</option>
              <option value="16K">16K</option>
              <option value="32K">32K</option>
              <option value="64K">64K</option>
              <option value="128K">128K (default)</option>
              <option value="256K">256K</option>
              <option value="512K">512K</option>
              <option value="1M">1M</option>
            </select>
          </div>

          {/* Quota */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Quota <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={quota}
              onChange={(e) => setQuota(e.target.value)}
              placeholder="e.g., 100G, 1T, or leave empty for none"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Access Time */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Access Time (atime)</label>
            <select
              value={atime}
              onChange={(e) => setAtime(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="on">On</option>
              <option value="off">Off (recommended)</option>
            </select>
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
              disabled={!name || !parent || isSubmitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create Dataset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
