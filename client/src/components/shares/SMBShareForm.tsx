import { useState } from 'react';
import { X } from 'lucide-react';
import type { SMBShare } from '@zfs-manager/shared';
import { shareApi } from '@/api/endpoints';

interface SMBShareFormProps {
  open: boolean;
  share?: SMBShare | null;
  onClose: () => void;
  onSaved: () => void;
}

export function SMBShareForm({ open, share, onClose, onSaved }: SMBShareFormProps) {
  const isEdit = !!share;

  const [name, setName] = useState(share?.name ?? '');
  const [path, setPath] = useState(share?.path ?? '');
  const [comment, setComment] = useState(share?.comment ?? '');
  const [browseable, setBrowseable] = useState(share?.browseable ?? true);
  const [readonly, setReadonly] = useState(share?.readonly ?? false);
  const [guestOk, setGuestOk] = useState(share?.guestOk ?? false);
  const [validUsers, setValidUsers] = useState(share?.validUsers?.join(', ') ?? '');
  const [writeList, setWriteList] = useState(share?.writeList?.join(', ') ?? '');
  const [createMask, setCreateMask] = useState(share?.createMask ?? '0664');
  const [directoryMask, setDirectoryMask] = useState(share?.directoryMask ?? '0775');
  const [forceUser, setForceUser] = useState(share?.forceUser ?? '');
  const [forceGroup, setForceGroup] = useState(share?.forceGroup ?? '');
  const [recycleEnabled, setRecycleEnabled] = useState(!!share?.recycleRepository);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const shareData = {
        name,
        path,
        comment: comment || undefined,
        browseable,
        readonly,
        guestOk,
        validUsers: validUsers ? validUsers.split(',').map((u) => u.trim()).filter(Boolean) : undefined,
        writeList: writeList ? writeList.split(',').map((u) => u.trim()).filter(Boolean) : undefined,
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
            {isEdit ? 'Edit SMB Share' : 'Create SMB Share'}
          </h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
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
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Valid Users</label>
                <input
                  type="text"
                  value={validUsers}
                  onChange={(e) => setValidUsers(e.target.value)}
                  placeholder="user1, user2, @group1"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Write List</label>
                <input
                  type="text"
                  value={writeList}
                  onChange={(e) => setWriteList(e.target.value)}
                  placeholder="user1, @group1"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
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
