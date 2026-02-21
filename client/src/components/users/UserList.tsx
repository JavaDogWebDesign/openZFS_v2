import { Users, Edit, Trash2, Shield, Lock, Unlock } from 'lucide-react';
import type { SystemUser } from '@zfs-manager/shared';
import { cn } from '@/lib/utils';

interface UserListProps {
  users: SystemUser[];
  isLoading: boolean;
  onEdit?: (user: SystemUser) => void;
  onDelete?: (username: string) => void;
}

export function UserList({ users, isLoading, onEdit, onDelete }: UserListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
        <Users className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium text-foreground">No users found</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Create system users to manage access to shares and datasets.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Username</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Full Name</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">UID</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Groups</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Shell</th>
            <th className="px-4 py-3 text-center font-medium text-muted-foreground">SMB</th>
            <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr
              key={user.username}
              className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
            >
              <td className="px-4 py-3">
                <div className="flex items-center space-x-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-foreground">{user.username}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-foreground">{user.fullName || '-'}</td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{user.uid}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {user.groups.slice(0, 3).map((g) => (
                    <span key={g} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {g}
                    </span>
                  ))}
                  {user.groups.length > 3 && (
                    <span className="text-xs text-muted-foreground">+{user.groups.length - 3}</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{user.shell}</td>
              <td className="px-4 py-3 text-center">
                {user.smbEnabled ? (
                  <Shield className="inline h-4 w-4 text-emerald-500" />
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                {user.locked ? (
                  <Lock className="inline h-4 w-4 text-yellow-500" />
                ) : (
                  <Unlock className="inline h-4 w-4 text-emerald-500" />
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end space-x-1">
                  <button
                    onClick={() => onEdit?.(user)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete?.(user.username)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
