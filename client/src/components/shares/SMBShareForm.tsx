import { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Check } from 'lucide-react';
import type { SMBShare, SystemUser } from '@zfs-manager/shared';
import { shareApi, userApi } from '@/api/endpoints';

interface SMBShareFormProps {
  open: boolean;
  share?: SMBShare | null;
  onClose: () => void;
  onSaved: () => void;
}

// ---------------------------------------------------------------------------
// Multi-select user picker component
// ---------------------------------------------------------------------------

interface UserPickerProps {
  label: string;
  hint: string;
  users: SystemUser[];
  loading: boolean;
  selected: string[];
  onChange: (selected: string[]) => void;
}

function UserPicker({ label, hint, users, loading, selected, onChange }: UserPickerProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [dropdownOpen]);

  const toggle = (username: string) => {
    if (selected.includes(username)) {
      onChange(selected.filter((u) => u !== username));
    } else {
      onChange([...selected, username]);
    }
  };

  const remove = (username: string) => {
    onChange(selected.filter((u) => u !== username));
  };

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-foreground mb-1">{label}</label>

      {/* Selected chips + trigger */}
      <button
        type="button"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex w-full min-h-[38px] items-center gap-1 flex-wrap rounded-md border border-input bg-background px-3 py-1.5 text-sm text-left focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {selected.length === 0 && (
          <span className="text-muted-foreground">Select users...</span>
        )}
        {selected.map((username) => (
          <span
            key={username}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          >
            {username}
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(username);
              }}
              className="hover:text-destructive cursor-pointer"
            >
              <X className="h-3 w-3" />
            </span>
          </span>
        ))}
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>

      {/* Dropdown */}
      {dropdownOpen && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {loading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No users found</div>
          ) : (
            users.map((user) => {
              const isSelected = selected.includes(user.username);
              return (
                <button
                  key={user.username}
                  type="button"
                  onClick={() => toggle(user.username)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors ${
                    isSelected ? 'bg-accent/50' : ''
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input'
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </span>
                  <span className="font-medium">{user.username}</span>
                  {user.fullName && (
                    <span className="text-muted-foreground">({user.fullName})</span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">UID {user.uid}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SMB Share Form
// ---------------------------------------------------------------------------

export function SMBShareForm({ open, share, onClose, onSaved }: SMBShareFormProps) {
  const isEdit = !!share;

  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [comment, setComment] = useState('');
  const [browseable, setBrowseable] = useState(true);
  const [readonly, setReadonly] = useState(false);
  const [guestOk, setGuestOk] = useState(false);
  const [validUsers, setValidUsers] = useState<string[]>([]);
  const [writeList, setWriteList] = useState<string[]>([]);
  const [createMask, setCreateMask] = useState('0664');
  const [directoryMask, setDirectoryMask] = useState('0775');
  const [forceUser, setForceUser] = useState('');
  const [forceGroup, setForceGroup] = useState('');
  const [recycleEnabled, setRecycleEnabled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form state when share prop or open state changes
  useEffect(() => {
    if (!open) return;
    setName(share?.name ?? '');
    setPath(share?.path ?? '');
    setComment(share?.comment ?? '');
    setBrowseable(share?.browseable ?? true);
    setReadonly(share?.readonly ?? false);
    setGuestOk(share?.guestOk ?? false);
    setValidUsers(share?.validUsers ?? []);
    setWriteList(share?.writeList ?? []);
    setCreateMask(share?.createMask ?? '0664');
    setDirectoryMask(share?.directoryMask ?? '0775');
    setForceUser(share?.forceUser ?? '');
    setForceGroup(share?.forceGroup ?? '');
    setRecycleEnabled(!!share?.recycleRepository);
    setShowAdvanced(false);
    setError(null);
  }, [open, share]);

  // Fetch system users when the form opens
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUsersLoading(true);
    userApi.list().then((result) => {
      if (result.success) {
        // Filter out system accounts (uid < 1000) except root
        const humanUsers = (result.data ?? []).filter(
          (u) => u.uid >= 1000 || u.username === 'root',
        );
        setSystemUsers(humanUsers);
      }
    }).finally(() => setUsersLoading(false));
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const shareData = {
        name,
        path,
        comment: comment || undefined,
        browseable,
        readonly,
        guestOk,
        validUsers: validUsers.length > 0 ? validUsers : undefined,
        writeList: writeList.length > 0 ? writeList : undefined,
        createMask,
        directoryMask,
        forceUser: forceUser || undefined,
        forceGroup: forceGroup || undefined,
        recycleRepository: recycleEnabled ? '.recycle' : undefined,
      };

      const result = isEdit
        ? await shareApi.updateSmb(share!.name, shareData)
        : await shareApi.createSmb(shareData);

      if (result.success) {
        onSaved();
        onClose();
      } else {
        setError(result.error?.message ?? 'Failed to save share');
      }
    } catch {
      setError('Network error while saving share');
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
            {isEdit ? 'Edit SMB Share' : 'Create SMB Share'}
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

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Share Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isEdit}
              required
              placeholder="my-share"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            />
          </div>

          {/* Path */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Path</label>
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              required
              placeholder="/mnt/pool/dataset"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
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

          {/* User Access - multi-select dropdowns */}
          <UserPicker
            label="Valid Users"
            hint="Users allowed to access this share. Leave empty to allow all users."
            users={systemUsers}
            loading={usersLoading}
            selected={validUsers}
            onChange={setValidUsers}
          />

          <UserPicker
            label="Write List"
            hint="Users with write access, even if the share is set to read-only."
            users={systemUsers}
            loading={usersLoading}
            selected={writeList}
            onChange={setWriteList}
          />

          {/* Basic options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-foreground">Browseable</label>
              <button
                type="button"
                onClick={() => setBrowseable(!browseable)}
                className={`relative h-6 w-11 rounded-full transition-colors ${browseable ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${browseable ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-foreground">Read Only</label>
              <button
                type="button"
                onClick={() => setReadonly(!readonly)}
                className={`relative h-6 w-11 rounded-full transition-colors ${readonly ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${readonly ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-foreground">Guest Access</label>
              <button
                type="button"
                onClick={() => setGuestOk(!guestOk)}
                className={`relative h-6 w-11 rounded-full transition-colors ${guestOk ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${guestOk ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {/* Advanced options toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-primary hover:underline"
          >
            {showAdvanced ? 'Hide' : 'Show'} advanced options
          </button>

          {showAdvanced && (
            <div className="space-y-4 rounded-lg border border-border p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Create Mask</label>
                  <input
                    type="text"
                    value={createMask}
                    onChange={(e) => setCreateMask(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Directory Mask</label>
                  <input
                    type="text"
                    value={directoryMask}
                    onChange={(e) => setDirectoryMask(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Force User</label>
                  <input
                    type="text"
                    value={forceUser}
                    onChange={(e) => setForceUser(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Force Group</label>
                  <input
                    type="text"
                    value={forceGroup}
                    onChange={(e) => setForceGroup(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="recycle"
                  checked={recycleEnabled}
                  onChange={(e) => setRecycleEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <label htmlFor="recycle" className="text-sm text-foreground">
                  Enable Recycle Bin
                </label>
              </div>
            </div>
          )}

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
              disabled={!name || !path || isSubmitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Update Share' : 'Create Share'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
