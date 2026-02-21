import { useState } from 'react';
import { X, UsersRound } from 'lucide-react';
import { groupApi } from '@/api/endpoints';

interface GroupCreateProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  availableUsers?: string[];
}

export function GroupCreate({ open, onClose, onCreated, availableUsers = [] }: GroupCreateProps) {
  const [name, setName] = useState('');
  const [gid, setGid] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const toggleMember = (username: string) => {
    setSelectedMembers((prev) =>
      prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await groupApi.create({
        name,
        gid: gid ? parseInt(gid, 10) : undefined,
        members: selectedMembers.length > 0 ? selectedMembers : undefined,
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

      <div className="relative z-50 w-full max-w-md rounded-lg border border-border bg-card shadow-lg animate-fade-in">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center space-x-2">
            <UsersRound className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-card-foreground">Create Group</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Group name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Group Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="mygroup"
              pattern="[a-z_][a-z0-9_-]*"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* GID */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              GID <span className="text-muted-foreground font-normal">(optional, auto-assigned if empty)</span>
            </label>
            <input
              type="number"
              value={gid}
              onChange={(e) => setGid(e.target.value)}
              placeholder="Auto"
              min={1000}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Members */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Initial Members</label>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border p-2 space-y-1">
              {availableUsers.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                  No users available
                </p>
              ) : (
                availableUsers.map((username) => (
                  <label
                    key={username}
                    className="flex items-center space-x-2 rounded px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(username)}
                      onChange={() => toggleMember(username)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <span className="text-sm text-foreground">{username}</span>
                  </label>
                ))
              )}
            </div>
            {selectedMembers.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected
              </p>
            )}
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
              disabled={!name || isSubmitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
