import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import type { Disk } from '@zfs-manager/shared';
import type { WizardState } from '../RaidWizard';
import { DiskCard } from '../components/DiskCard';
import { diskApi } from '@/api/endpoints';

interface DiskSelectionProps {
  state: WizardState;
  onUpdate: (updates: Partial<WizardState>) => void;
}

export function DiskSelection({ state, onUpdate }: DiskSelectionProps) {
  const [availableDisks, setAvailableDisks] = useState<Disk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchDisks = async () => {
      setIsLoading(true);
      try {
        const result = await diskApi.list();
        if (result.success) {
          setAvailableDisks(result.data);
        }
      } catch {
        // Keep empty list on error
      } finally {
        setIsLoading(false);
      }
    };
    fetchDisks();
  }, []);

  const filteredDisks = availableDisks.filter(
    (d) =>
      !d.inUse &&
      (d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.model.toLowerCase().includes(search.toLowerCase()) ||
        d.serial.toLowerCase().includes(search.toLowerCase())),
  );

  const isSelected = (disk: Disk) =>
    state.selectedDisks.some((d) => d.name === disk.name);

  const toggleDisk = (disk: Disk) => {
    if (isSelected(disk)) {
      onUpdate({
        selectedDisks: state.selectedDisks.filter((d) => d.name !== disk.name),
      });
    } else {
      onUpdate({
        selectedDisks: [...state.selectedDisks, disk],
      });
    }
  };

  const selectAll = () => {
    onUpdate({ selectedDisks: filteredDisks });
  };

  const deselectAll = () => {
    onUpdate({ selectedDisks: [] });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Select Disks</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the disks to include in your new pool. Only unused disks are shown.
        </p>
      </div>

      {/* Search and actions */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search disks..."
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex space-x-2">
          <button
            onClick={selectAll}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
          >
            Select All
          </button>
          <button
            onClick={deselectAll}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Selection count */}
      <div className="text-sm text-muted-foreground">
        {state.selectedDisks.length} of {filteredDisks.length} disks selected
      </div>

      {/* Disk grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : filteredDisks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {availableDisks.length === 0
              ? 'No unused disks available on this system'
              : 'No disks match your search'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDisks.map((disk) => (
            <DiskCard
              key={disk.name}
              disk={disk}
              selected={isSelected(disk)}
              onToggle={() => toggleDisk(disk)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
