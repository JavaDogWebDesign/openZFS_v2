import { UsersRound, Edit, Trash2 } from 'lucide-react';
import type { SystemGroup } from '@zfs-manager/shared';

interface GroupListProps {
  groups: SystemGroup[];
  isLoading: boolean;
  onEdit?: (group: SystemGroup) => void;
  onDelete?: (name: string) => void;
}

export function GroupList({ groups, isLoading, onEdit, onDelete }: GroupListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
        <UsersRound className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium text-foreground">No groups found</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Create groups to manage user permissions for shares and datasets.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Group Name</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">GID</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Members</th>
            <th className="px-4 py-3 text-center font-medium text-muted-foreground">Count</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr
              key={group.name}
              className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
            >
              <td className="px-4 py-3">
                <div className="flex items-center space-x-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
                    <UsersRound className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-foreground">{group.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{group.gid}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {group.members.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">No members</span>
                  ) : (
                    <>
                      {group.members.slice(0, 5).map((member) => (
                        <span
                          key={member}
                          className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                        >
                          {member}
                        </span>
                      ))}
                      {group.members.length > 5 && (
                        <span className="text-xs text-muted-foreground">
                          +{group.members.length - 5} more
                        </span>
                      )}
                    </>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {group.members.length}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end space-x-1">
                  <button
                    onClick={() => onEdit?.(group)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete?.(group.name)}
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
