import { useState, useEffect } from 'react';
import { HardDrive, Thermometer, Clock, Shield } from 'lucide-react';
import type { Disk, SMARTData, SMARTAttribute } from '@zfs-manager/shared';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/formatBytes';
import { DriveHealth } from './DriveHealth';
import { diskApi } from '@/api/endpoints';

interface DriveDetailProps {
  disk: Disk;
}

export function DriveDetail({ disk }: DriveDetailProps) {
  const [smartData, setSmartData] = useState<SMARTData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSmartData = async () => {
      setIsLoading(true);
      try {
        const result = await diskApi.getSmart(disk.name);
        if (result.success) {
          setSmartData(result.data);
        } else {
          setSmartData(null);
        }
      } catch {
        setSmartData(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSmartData();
  }, [disk.name]);

  return (
    <div className="space-y-6">
      {/* Drive info header */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className="rounded-lg bg-muted p-3">
              <HardDrive className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-card-foreground">{disk.name}</h3>
              <p className="text-sm text-muted-foreground">{disk.model}</p>
            </div>
          </div>
          <DriveHealth health={disk.health} size="lg" />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <InfoItem label="Serial Number" value={disk.serial || 'N/A'} />
          <InfoItem label="Size" value={formatBytes(disk.size)} />
          <InfoItem label="Type" value={disk.type.toUpperCase()} />
          <InfoItem label="Transport" value={disk.transport || 'N/A'} />
          <InfoItem label="Vendor" value={disk.vendor || 'N/A'} />
          <InfoItem label="Rotational" value={disk.rotational ? 'Yes (HDD)' : 'No (SSD)'} />
          <InfoItem label="Pool" value={disk.pool || 'Unassigned'} />
          <InfoItem
            label="Temperature"
            value={disk.temperature != null ? `${disk.temperature}°C` : 'N/A'}
            icon={<Thermometer className="h-4 w-4" />}
          />
        </div>
      </div>

      {/* Partitions */}
      {disk.partitions.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h4 className="text-base font-semibold text-card-foreground mb-3">Partitions</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Size</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">FS Type</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mount</th>
                </tr>
              </thead>
              <tbody>
                {disk.partitions.map((part) => (
                  <tr key={part.name} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground">{part.name}</td>
                    <td className="px-3 py-2 text-foreground">{formatBytes(part.size)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{part.type}</td>
                    <td className="px-3 py-2 text-muted-foreground">{part.fstype || '-'}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {part.mountpoint || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SMART Attributes */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h4 className="text-base font-semibold text-card-foreground">SMART Attributes</h4>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : smartData ? (
          <>
            <div className="mb-4 flex items-center space-x-4 text-sm">
              <span className="text-muted-foreground">
                Overall: <span className={cn(
                  'font-medium',
                  smartData.overallAssessment === 'PASSED' ? 'text-emerald-500' : 'text-destructive',
                )}>
                  {smartData.overallAssessment}
                </span>
              </span>
              {smartData.powerOnHours != null && (
                <span className="flex items-center text-muted-foreground">
                  <Clock className="mr-1 h-3 w-3" />
                  {smartData.powerOnHours.toLocaleString()} hours
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">ID</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Attribute</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Value</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Worst</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Thresh</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Raw</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {smartData.attributes.map((attr) => (
                    <tr key={attr.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {attr.id}
                      </td>
                      <td className="px-3 py-2 text-foreground">{attr.name}</td>
                      <td className="px-3 py-2 text-right text-foreground">{attr.value}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{attr.worst}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{attr.threshold}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {attr.rawValue}
                      </td>
                      <td className="px-3 py-2">
                        {attr.value <= attr.threshold ? (
                          <span className="text-xs text-destructive font-medium">FAILING</span>
                        ) : (
                          <span className="text-xs text-emerald-500">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            SMART data is not available for this drive. The drive may not support SMART or SMART monitoring may be disabled.
          </p>
        )}
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 flex items-center space-x-1 text-sm font-medium text-foreground">
        {icon}
        <span>{value}</span>
      </p>
    </div>
  );
}
