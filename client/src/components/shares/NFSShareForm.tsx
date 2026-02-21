import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { NFSShare, NFSAccessRule } from '@zfs-manager/shared';
import { shareApi } from '@/api/endpoints';

interface NFSShareFormProps {
  open: boolean;
  share?: NFSShare | null;
  onClose: () => void;
  onSaved: () => void;
}

export function NFSShareForm({ open, share, onClose, onSaved }: NFSShareFormProps) {
  const isEdit = !!share;

  const [path, setPath] = useState(share?.path ?? '');
  const [comment, setComment] = useState(share?.comment ?? '');
  const [rules, setRules] = useState<NFSAccessRule[]>(
    share?.rules ?? [{ host: '*', options: ['rw', 'sync', 'no_subtree_check'] }],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const addRule = () => {
    setRules([...rules, { host: '', options: ['ro', 'sync'] }]);
  };

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const updateRuleHost = (index: number, host: string) => {
    setRules(rules.map((r, i) => (i === index ? { ...r, host } : r)));
  };

  const updateRuleOptions = (index: number, options: string) => {
    setRules(
      rules.map((r, i) =>
        i === index ? { ...r, options: options.split(',').map((o) => o.trim()) } : r,
      ),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const shareData = {
        path,
        comment: comment || undefined,
        rules,
      };

      const result = isEdit
        ? await shareApi.updateNfs(share!.path, shareData)
        : await shareApi.createNfs(shareData);

      if (result.success) {
        onSaved();
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

      <div className="relative z-50 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg animate-fade-in">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-card-foreground">
            {isEdit ? 'Edit NFS Export' : 'Create NFS Export'}
          </h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Path */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Export Path</label>
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              disabled={isEdit}
              required
              placeholder="/mnt/pool/dataset"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            />
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Comment</label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional description"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Access Rules */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">Access Rules</label>
              <button
                type="button"
                onClick={addRule}
                className="flex items-center space-x-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors"
              >
                <Plus className="h-3 w-3" />
                <span>Add Rule</span>
              </button>
            </div>

            <div className="space-y-3">
              {rules.map((rule, idx) => (
                <div key={idx} className="flex items-start space-x-2 rounded-lg border border-border p-3">
                  <div className="flex-1 space-y-2">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Host / Network</label>
                      <input
                        type="text"
                        value={rule.host}
                        onChange={(e) => updateRuleHost(idx, e.target.value)}
                        placeholder="192.168.1.0/24 or * for all"
                        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Options</label>
                      <input
                        type="text"
                        value={rule.options.join(',')}
                        onChange={(e) => updateRuleOptions(idx, e.target.value)}
                        placeholder="rw,sync,no_subtree_check"
                        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm font-mono placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  </div>
                  {rules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRule(idx)}
                      className="mt-5 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="font-medium mb-1">Common NFS options:</p>
            <ul className="space-y-0.5">
              <li><code>rw</code> - Read-write access</li>
              <li><code>ro</code> - Read-only access</li>
              <li><code>sync</code> - Synchronous writes</li>
              <li><code>no_root_squash</code> - Allow root access</li>
              <li><code>no_subtree_check</code> - Disable subtree checking</li>
            </ul>
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
              disabled={!path || rules.length === 0 || isSubmitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Update Export' : 'Create Export'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
