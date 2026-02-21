import { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import type { SystemUser } from '@zfs-manager/shared';
import { userApi, groupApi } from '@/api/endpoints';
import { UserList } from '@/components/users/UserList';
import { UserCreate } from '@/components/users/UserCreate';
import { UserEdit } from '@/components/users/UserEdit';
import { useConfirm } from '@/hooks/useConfirm';

export function UsersPage() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const { confirm } = useConfirm();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const [usersResult, groupsResult] = await Promise.all([
      userApi.list(),
      groupApi.list(),
    ]);
    if (usersResult.success) {
      setUsers(usersResult.data);
    }
    if (groupsResult.success) {
      setGroups(groupsResult.data.map((g) => g.name));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = () => {
    fetchData();
  };

  const handleDelete = async (username: string) => {
    const confirmed = await confirm({
      title: 'Delete User',
      description: `Are you sure you want to delete user "${username}"? This will remove the user from all groups.`,
      confirmLabel: 'Delete User',
      destructive: true,
    });
    if (confirmed) {
      const result = await userApi.destroy(username);
      if (result.success) {
        refetch();
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage system users, group memberships, and SMB access
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center space-x-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Create User</span>
        </button>
      </div>

      <UserList
        users={users}
        isLoading={isLoading}
        onEdit={(user) => setEditingUser(user)}
        onDelete={handleDelete}
      />

      <UserCreate
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={refetch}
        availableGroups={groups}
      />

      <UserEdit
        open={!!editingUser}
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onSaved={refetch}
        availableGroups={groups}
      />
    </div>
  );
}
