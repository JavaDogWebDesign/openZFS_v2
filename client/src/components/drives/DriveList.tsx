import { useState, useEffect } from 'react';
import { HardDrive, Search, Filter } from 'lucide-react';
import type { Disk } from '@zfs-manager/shared';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/formatBytes';
import { StatusBadge } from '@/components/common/StatusBadge';
import { DriveHealth } from './DriveHealth';

interface DriveListProps {
  disks: Disk[];
  isLoading: boolean;
  onSelect?: (disk: Disk) => void;
  selectedDisk?: string | null;
}

export function DriveList({ disks, isLoading, onSelect, selectedDisk }: DriveListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'disk' | 'ssd' | 'nvme'>('all');

  const filtered = disks.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.serial.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || d.type === filterType;
    return matchesSearch && matchesType;
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="flex items-center space-x-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, model, or serial..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex rounded-md border border-border">
          {(['all', 'disk', 'ssd', 'nvme'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn(
                'px-3 py-2 text-xs font-medium transition-colors first:rounded-l-md last:rounded-r-md',
                filterType === type
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {type.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Drive table */}
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Drive</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Model</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Serial</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Size</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Health</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Pool</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Temp</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                  {disks.length === 0 ? 'No drives detected' : 'No drives match your filters'}
                </td>
              </tr>
            ) : (
              filtered.map((disk) => (
                <tr
                  key={disk.name}
                  className={cn(
                    'border-b border-border last:border-0 cursor-pointer transition-colors',
                    selectedDisk === disk.name
                      ? 'bg-primary/5'
                      : 'hover:bg-muted/30',
                  )}
                  onClick={() => onSelect?.(disk)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <HardDrive className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">{disk.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground">{disk.model || '-'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {disk.serial || '-'}
                  </td>
                  <td className="px-4 py-3 text-foreground">{formatBytes(disk.size)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {disk.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <DriveHealth health={disk.health} />
                  </td>
                  <td className="px-4 py-3">
                    {disk.pool ? (
                      <span className="text-primary">{disk.pool}</span>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {disk.temperature != null ? `${disk.temperature}°C` : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
