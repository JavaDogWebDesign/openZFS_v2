import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import type { SystemUser, SMBShare } from '@zfs-manager/shared';
import { userApi, shareApi } from '@/api/endpoints';

interface UserEditProps {
  open: boolean;
  user: SystemUser | null;
  onClose: () => void;
  onSaved: () => void;
  availableGroups?: string[];
}

export function UserEdit({ open, user, onClose, onSaved, availableGroups = [] }: UserEditProps) {
  const [fullName, setFullName] = useState('');
  const [shell, setShell] = useState('/bin/bash');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [changePassword, setChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [changeSmbPassword, setChangeSmbPassword] = useState(false);
  const [smbPassword, setSmbPassword] = useState('');
  const [selectedShares, setSelectedShares] = useState<string[]>([]);
  const [availableShares, setAvailableShares] = useState<SMBShare[]>([]);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form state when user or open state changes
  useEffect(() => {
    if (!open || !user) return;
    setFullName(user.fullName ?? '');
    setShell(user.shell ?? '/bin/bash');
    setSelectedGroups(user.groups ?? []);
    setChangePassword(false);
    setNewPassword('');
    setChangeSmbPassword(false);
    setSmbPassword('');
    setError(null);

    // Fetch available shares and current assignments
    setSharesLoading(true);
    Promise.all([
      shareApi.listSmb(),
      userApi.getShares(user.username),
    ]).then(([sharesResult, assignedResult]) => {
      if (sharesResult.success) {
        setAvailableShares(sharesResult.data ?? []);
      }
      if (assignedResult.success) {
        setSelectedShares(assignedResult.data ?? []);
      }
    }).finally(() => setSharesLoading(false));
  }, [open, user]);

  if (!open || !user) return null;

  const toggleGroup = (group: string) => {
    setSelectedGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group],
    );
  };

  const toggleShare = (shareName: string) => {
    setSelectedShares((prev) =>
      prev.includes(shareName) ? prev.filter((s) => s !== shareName) : [...prev, shareName],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const updateResult = await userApi.update(user.username, {
        fullName,
        shell,
        groups: selectedGroups,
        password: changePassword ? newPassword : undefined,
      });

      if (updateResult.success && changeSmbPassword && smbPassword) {
        const smbResult = await userApi.setSmbPassword(user.username, smbPassword);
        if (!smbResult.success) {
          setError(`User updated but SMB password failed: ${smbResult.error?.message}`);
          setIsSubmitting(false);
          return;
        }
      }

      // Update share assignments
      if (updateResult.success) {
        const shareResult = await userApi.setShares(user.username, selectedShares);
        if (!shareResult.success) {
          console.error('[users] Failed to update share assignments:', shareResult.error);
        }
      }

      if (updateResult.success) {
        onSaved();
        onClose();
      } else {
        setError(updateResult.error?.message ?? 'Failed to update user');
      }
    } catch {
      setError('Network error while updating user');
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
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

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

          {/* Share Access */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground">Share Access</label>
              <p className="text-xs text-muted-foreground">Select SMB shares this user can read and write to</p>
            </div>
            {sharesLoading ? (
              <p className="text-xs text-muted-foreground">Loading shares...</p>
            ) : availableShares.length === 0 ? (
              <p className="text-xs text-muted-foreground">No shares configured yet</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableShares.map((share) => (
                  <button
                    key={share.name}
                    type="button"
                    onClick={() => toggleShare(share.name)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      selectedShares.includes(share.name)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {share.name}
                    <span className="ml-1 text-[10px] opacity-60">{share.path}</span>
                  </button>
                ))}
              </div>
            )}
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

          {/* SMB Password */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="changeSmbPassword"
                checked={changeSmbPassword}
                onChange={(e) => setChangeSmbPassword(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <div>
                <label htmlFor="changeSmbPassword" className="text-sm font-medium text-foreground">
                  {user.smbEnabled ? 'Change SMB password' : 'Enable SMB / File Sharing'}
                </label>
                <p className="text-xs text-muted-foreground">
                  {user.smbEnabled
                    ? 'Update the Samba password for this user'
                    : 'Set an SMB password to allow this user to connect to file shares'}
                </p>
              </div>
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
