import { useState, useEffect, useCallback } from 'react';
import { Settings, Server, Clock, Database, Shield, RefreshCw } from 'lucide-react';
import type { SystemInfo, ScrubSchedule, TrimSchedule } from '@zfs-manager/shared';
import { monitoringApi, poolApi } from '@/api/endpoints';
import { formatBytes } from '@/lib/formatBytes';

export function SettingsPage() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [scrubSchedules, setScrubSchedules] = useState<ScrubSchedule[]>([]);
  const [trimSchedules, setTrimSchedules] = useState<TrimSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    const [systemResult, scrubResult, trimResult] = await Promise.all([
      monitoringApi.system(),
      poolApi.getScrubSchedules(),
      poolApi.getTrimSchedules(),
    ]);
    if (systemResult.success) {
      setSystemInfo(systemResult.data);
    }
    if (scrubResult.success) {
      setScrubSchedules(scrubResult.data);
    }
    if (trimResult.success) {
      setTrimSchedules(trimResult.data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          System information and scheduled maintenance management
        </p>
      </div>

      {/* System Information */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Server className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-card-foreground">System Information</h2>
        </div>

        {systemInfo ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoCard label="Hostname" value={systemInfo.hostname} />
            <InfoCard label="Platform" value={`${systemInfo.platform} (${systemInfo.arch})`} />
            <InfoCard label="Kernel" value={systemInfo.kernelVersion} />
            <InfoCard label="CPU" value={`${systemInfo.cpuModel} (${systemInfo.cpuCount} cores)`} />
            <InfoCard
              label="Memory"
              value={`${formatBytes(systemInfo.freeMemory)} free / ${formatBytes(systemInfo.totalMemory)}`}
            />
            <InfoCard
              label="Uptime"
              value={`${Math.floor(systemInfo.uptime / 86400)} days, ${Math.floor(
                (systemInfo.uptime % 86400) / 3600,
              )} hours`}
            />
            <InfoCard label="ZFS Version" value={systemInfo.zfsVersion} />
            <InfoCard label="ZFS Module" value={systemInfo.zfsModuleVersion ?? 'N/A'} />
            <InfoCard
              label="Load Average"
              value={systemInfo.loadAverage.map((l) => l.toFixed(2)).join(' / ')}
            />
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {isLoading ? 'Loading system information...' : 'Unable to load system information'}
            </p>
          </div>
        )}
      </div>

      {/* Scrub Schedules */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-card-foreground">Scrub Schedules</h2>
          </div>
          <button className="flex items-center space-x-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors">
            <Clock className="h-4 w-4" />
            <span>Add Schedule</span>
          </button>
        </div>

        {scrubSchedules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Clock className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">No scrub schedules configured</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Regular scrubs help detect data corruption early. We recommend weekly scrubs for important data.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Pool</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Schedule</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Last Run</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Next Run</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Enabled</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {scrubSchedules.map((schedule) => (
                  <tr key={schedule.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground">{schedule.pool}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{schedule.cronExpression}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {schedule.lastRun ? new Date(schedule.lastRun).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      {schedule.nextRun ? new Date(schedule.nextRun).toLocaleString() : '-'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={schedule.enabled ? 'text-emerald-500' : 'text-muted-foreground'}>
                        {schedule.enabled ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button className="text-xs text-destructive hover:underline">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TRIM Schedules */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-card-foreground">TRIM Schedules</h2>
          </div>
          <button className="flex items-center space-x-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors">
            <Clock className="h-4 w-4" />
            <span>Add Schedule</span>
          </button>
        </div>

        {trimSchedules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Clock className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">No TRIM schedules configured</p>
            <p className="mt-1 text-xs text-muted-foreground">
              TRIM is beneficial for SSD-based pools. It helps maintain SSD performance over time.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Pool</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Schedule</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Last Run</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Next Run</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Enabled</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {trimSchedules.map((schedule) => (
                  <tr key={schedule.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground">{schedule.pool}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{schedule.cronExpression}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {schedule.lastRun ? new Date(schedule.lastRun).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      {schedule.nextRun ? new Date(schedule.nextRun).toLocaleString() : '-'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={schedule.enabled ? 'text-emerald-500' : 'text-muted-foreground'}>
                        {schedule.enabled ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button className="text-xs text-destructive hover:underline">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
