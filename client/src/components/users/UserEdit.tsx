import { useState } from 'react';
import { X, Save } from 'lucide-react';
import type { SystemUser } from '@zfs-manager/shared';
import { userApi } from '@/api/endpoints';

interface UserEditProps {
  open: boolean;
  user: SystemUser | null;
  onClose: () => void;
  onSaved: () => void;
  availableGroups?: string[];
}

export function UserEdit({ open, user, onClose, onSaved, availableGroups = [] }: UserEditProps) {
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [shell, setShell] = useState(user?.shell ?? '/bin/bash');
  const [selectedGroups, setSelectedGroups] = useState<string[]>(user?.groups ?? []);
  const [changePassword, setChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [changeSmbPassword, setChangeSmbPassword] = useState(false);
  const [smbPassword, setSmbPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open || !user) return null;

  const toggleGroup = (group: string) => {
    setSelectedGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const updateResult = await userApi.update(user.username, {
        fullName,
        shell,
        groups: selectedGroups,
        password: changePassword ? newPassword : undefined,
      });

      if (updateResult.success && changeSmbPassword && smbPassword) {
        await userApi.setSmbPassword(user.username, smbPassword);
      }

      if (updateResult.success) {
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
            Edit User: {user.username}
          </h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Username (read-only) */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Username</label>
            <input
              type="text"
              value={user.username}
              disabled
              className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
            />
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Shell */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Shell</label>
            <select
              value={shell}
              onChange={(e) => setShell(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="/bin/bash">Bash (/bin/bash)</option>
              <option value="/bin/zsh">Zsh (/bin/zsh)</option>
              <option value="/bin/sh">Sh (/bin/sh)</option>
              <option value="/usr/sbin/nologin">No Login (/usr/sbin/nologin)</option>
              <option value="/bin/false">False (/bin/false)</option>
            </select>
          </div>

          {/* Groups */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Groups</label>
            <div className="flex flex-wrap gap-2">
              {availableGroups.map((group) => (
                <button
                  key={group}
                  type="button"
                  onClick={() => toggleGroup(group)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    selectedGroups.includes(group)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {group}
                </button>
              ))}
            </div>
          </div>

          {/* Change Password */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="changePassword"
                checked={changePassword}
                onChange={(e) => setChangePassword(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <label htmlFor="changePassword" className="text-sm font-medium text-foreground">
                Change system password
              </label>
            </div>
            {changePassword && (
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                minLength={8}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            )}
          </div>

          {/* Change SMB Password */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="changeSmbPassword"
                checked={changeSmbPassword}
                onChange={(e) => setChangeSmbPassword(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <label htmlFor="changeSmbPassword" className="text-sm font-medium text-foreground">
                Set SMB password
              </label>
            </div>
            {changeSmbPassword && (
              <input
                type="password"
                value={smbPassword}
                onChange={(e) => setSmbPassword(e.target.value)}
                placeholder="SMB password"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
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
