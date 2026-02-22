import { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { userApi } from '@/api/endpoints';

interface UserCreateProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  availableGroups?: string[];
}

export function UserCreate({ open, onClose, onCreated, availableGroups = [] }: UserCreateProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [shell, setShell] = useState('/bin/bash');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [createHome, setCreateHome] = useState(true);
  const [enableSmb, setEnableSmb] = useState(true);
  const [smbPassword, setSmbPassword] = useState('');
  const [useSamePassword, setUseSamePassword] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const passwordsMatch = password === confirmPassword;

  const toggleGroup = (group: string) => {
    setSelectedGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordsMatch) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await userApi.create({
        username,
        password,
        fullName: fullName || undefined,
        shell,
        groups: selectedGroups.length > 0 ? selectedGroups : undefined,
        createHome,
      });

      if (result.success) {
        // Set SMB password after user is created
        if (enableSmb) {
          const smbPwd = useSamePassword ? password : smbPassword;
          if (smbPwd) {
            const smbResult = await userApi.setSmbPassword(username, smbPwd);
            if (!smbResult.success) {
              console.error('[users] Failed to set SMB password:', smbResult.error);
            }
          }
        }
        onCreated();
        onClose();
      } else {
        setError(result.error?.message ?? 'Failed to create user');
      }
    } catch {
      setError('Network error while creating user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-50 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg animate-fade-in">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center space-x-2">
            <UserPlus className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-card-foreground">Create User</h2>
          </div>
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

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="johndoe"
              pattern="[a-z_][a-z0-9_-]*"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Lowercase letters, digits, hyphens, and underscores only
            </p>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                confirmPassword && !passwordsMatch
                  ? 'border-destructive focus:border-destructive focus:ring-destructive'
                  : 'border-input focus:border-ring focus:ring-ring'
              }`}
            />
            {confirmPassword && !passwordsMatch && (
              <p className="mt-1 text-xs text-destructive">Passwords do not match</p>
            )}
          </div>

          {/* Enable SMB */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-foreground">Enable SMB / File Sharing</label>
                <p className="text-xs text-muted-foreground">Allow this user to connect to Samba shares</p>
              </div>
              <button
                type="button"
                onClick={() => setEnableSmb(!enableSmb)}
                className={`relative h-6 w-11 rounded-full transition-colors ${enableSmb ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${enableSmb ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {enableSmb && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="useSamePassword"
                    checked={useSamePassword}
                    onChange={(e) => setUseSamePassword(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <label htmlFor="useSamePassword" className="text-sm text-foreground">
                    Use same password as system account
                  </label>
                </div>

                {!useSamePassword && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">SMB Password</label>
                    <input
                      type="password"
                      value={smbPassword}
                      onChange={(e) => setSmbPassword(e.target.value)}
                      placeholder="SMB password"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                )}
              </div>
            )}
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
              {availableGroups.length === 0 && (
                <p className="text-xs text-muted-foreground">No groups available</p>
              )}
            </div>
          </div>

          {/* Create Home */}
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="createHome"
              checked={createHome}
              onChange={(e) => setCreateHome(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <label htmlFor="createHome" className="text-sm text-foreground">
              Create home directory
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
              disabled={!username || !password || !passwordsMatch || isSubmitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
