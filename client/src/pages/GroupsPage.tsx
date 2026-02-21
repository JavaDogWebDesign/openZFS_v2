import { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import type { SystemGroup } from '@zfs-manager/shared';
import { groupApi, userApi } from '@/api/endpoints';
import { GroupList } from '@/components/groups/GroupList';
import { GroupCreate } from '@/components/groups/GroupCreate';
import { GroupEdit } from '@/components/groups/GroupEdit';
import { useConfirm } from '@/hooks/useConfirm';

export function GroupsPage() {
  const [groups, setGroups] = useState<SystemGroup[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SystemGroup | null>(null);
  const { confirm } = useConfirm();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const [groupsResult, usersResult] = await Promise.all([
      groupApi.list(),
      userApi.list(),
    ]);
    if (groupsResult.success) {
      setGroups(groupsResult.data);
    }
    if (usersResult.success) {
      setUsers(usersResult.data.map((u) => u.username));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = () => {
    fetchData();
  };

  const handleDelete = async (name: string) => {
    const confirmed = await confirm({
      title: 'Delete Group',
      description: `Are you sure you want to delete group "${name}"?`,
      confirmLabel: 'Delete Group',
      destructive: true,
    });
    if (confirmed) {
      const result = await groupApi.destroy(name);
      if (result.success) {
        refetch();
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Groups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage system groups and their member assignments
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center space-x-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Create Group</span>
        </button>
      </div>

      <GroupList
        groups={groups}
        isLoading={isLoading}
        onEdit={(group) => setEditingGroup(group)}
        onDelete={handleDelete}
      />

      <GroupCreate
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={refetch}
        availableUsers={users}
      />

      <GroupEdit
        open={!!editingGroup}
        group={editingGroup}
        onClose={() => setEditingGroup(null)}
        onSaved={refetch}
        availableUsers={users}
      />
    </div>
  );
}
