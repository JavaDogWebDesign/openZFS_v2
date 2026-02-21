import { useState } from 'react';
import { X, Save, UserPlus, UserMinus } from 'lucide-react';
import type { SystemGroup } from '@zfs-manager/shared';
import { groupApi } from '@/api/endpoints';

interface GroupEditProps {
  open: boolean;
  group: SystemGroup | null;
  onClose: () => void;
  onSaved: () => void;
  availableUsers?: string[];
}

export function GroupEdit({ open, group, onClose, onSaved, availableUsers = [] }: GroupEditProps) {
  const [members, setMembers] = useState<string[]>(group?.members ?? []);
  const [newMember, setNewMember] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open || !group) return null;

  const nonMembers = availableUsers.filter((u) => !members.includes(u));

  const addMember = (username: string) => {
    if (!members.includes(username)) {
      setMembers([...members, username]);
    }
    setNewMember('');
  };

  const removeMember = (username: string) => {
    setMembers(members.filter((m) => m !== username));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await groupApi.update(group.name, { members });
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

      <div className="relative z-50 w-full max-w-md rounded-lg border border-border bg-card shadow-lg animate-fade-in">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-card-foreground">
            Edit Group: {group.name}
          </h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Group info */}
          <div className="flex items-center space-x-4 rounded-lg bg-muted/50 p-3">
            <div>
              <p className="text-sm font-medium text-foreground">{group.name}</p>
              <p className="text-xs text-muted-foreground">GID: {group.gid}</p>
            </div>
          </div>

          {/* Current members */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Members ({members.length})
            </label>
            <div className="space-y-1">
              {members.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No members in this group
                </p>
              ) : (
                members.map((member) => (
                  <div
                    key={member}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                  >
                    <span className="text-sm text-foreground">{member}</span>
                    <button
                      type="button"
                      onClick={() => removeMember(member)}
                      className="flex items-center space-x-1 rounded p-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                      <UserMinus className="h-3 w-3" />
                      <span>Remove</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Add member */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Add Member</label>
            <div className="flex space-x-2">
              <select
                value={newMember}
                onChange={(e) => setNewMember(e.target.value)}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select a user...</option>
                {nonMembers.map((user) => (
                  <option key={user} value={user}>{user}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => newMember && addMember(newMember)}
                disabled={!newMember}
                className="flex items-center space-x-1 rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-50 transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                <span>Add</span>
              </button>
            </div>
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
              disabled={isSubmitting}
              className="flex items-center space-x-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Save className="h-4 w-4" />
              <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
