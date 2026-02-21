import { useState, useEffect, useCallback } from 'react';
import { HardDrive, X } from 'lucide-react';
import type { Disk } from '@zfs-manager/shared';
import { diskApi } from '@/api/endpoints';
import { DriveList } from '@/components/drives/DriveList';
import { DriveDetail } from '@/components/drives/DriveDetail';

export function DrivesPage() {
  const [disks, setDisks] = useState<Disk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDisk, setSelectedDisk] = useState<Disk | null>(null);

  const fetchDisks = useCallback(async () => {
    setIsLoading(true);
    const result = await diskApi.list();
    if (result.success) {
      setDisks(result.data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchDisks();
  }, [fetchDisks]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Drives</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View and manage physical drives, SMART data, and health status
        </p>
      </div>

      <div className="flex gap-6">
        {/* Drive list */}
        <div className={selectedDisk ? 'flex-1' : 'w-full'}>
          <DriveList
            disks={disks}
            isLoading={isLoading}
            onSelect={(disk) => setSelectedDisk(disk)}
            selectedDisk={selectedDisk?.name ?? null}
          />
        </div>

        {/* Detail panel */}
        {selectedDisk && (
          <div className="w-[400px] shrink-0">
            <div className="sticky top-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Drive Details</h3>
                <button
                  onClick={() => setSelectedDisk(null)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-accent"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <DriveDetail disk={selectedDisk} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
