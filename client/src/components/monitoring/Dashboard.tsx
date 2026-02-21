import { useState, useEffect } from 'react';
import {
  Database,
  HardDrive,
  AlertTriangle,
  Server,
  Cpu,
  MemoryStick,
  Clock,
  Activity,
} from 'lucide-react';
import type { Pool, Alert, SystemInfo } from '@zfs-manager/shared';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/formatBytes';
import { StatusBadge } from '@/components/common/StatusBadge';
import { poolApi, monitoringApi } from '@/api/endpoints';

export function Dashboard() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [poolsResult, alertsResult, systemResult] = await Promise.all([
          poolApi.list(),
          monitoringApi.alerts(),
          monitoringApi.system(),
        ]);
        if (poolsResult.success) setPools(poolsResult.data);
        if (alertsResult.success) setAlerts(alertsResult.data);
        if (systemResult.success) setSystemInfo(systemResult.data);
      } catch {
        // Keep defaults on error
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const activeAlerts = alerts.filter((a) => !a.acknowledged);
  const criticalAlerts = activeAlerts.filter((a) => a.severity === 'critical' || a.severity === 'error');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Overview of your ZFS storage system</p>
      </div>

      {/* Alert banner */}
      {criticalAlerts.length > 0 && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <p className="font-medium text-destructive">
              {criticalAlerts.length} critical alert{criticalAlerts.length !== 1 ? 's' : ''} require attention
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {criticalAlerts[0]?.message}
            </p>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={<Database className="h-5 w-5" />}
          label="Pools"
          value={String(pools.length)}
          detail={`${pools.filter((p) => p.status === 'ONLINE').length} healthy`}
          variant="primary"
        />
        <SummaryCard
          icon={<HardDrive className="h-5 w-5" />}
          label="Total Storage"
          value={formatBytes(pools.reduce((sum, p) => sum + p.size, 0))}
          detail={`${formatBytes(pools.reduce((sum, p) => sum + p.allocated, 0))} used`}
          variant="default"
        />
        <SummaryCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Active Alerts"
          value={String(activeAlerts.length)}
          detail={`${criticalAlerts.length} critical`}
          variant={criticalAlerts.length > 0 ? 'destructive' : 'default'}
        />
        <SummaryCard
          icon={<Activity className="h-5 w-5" />}
          label="System Load"
          value={systemInfo?.loadAverage?.[0]?.toFixed(2) ?? '-'}
          detail={`${systemInfo?.cpuCount ?? '-'} CPUs`}
          variant="default"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pool health */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-lg font-semibold text-card-foreground mb-4">Pool Health</h3>
          {pools.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pools configured</p>
          ) : (
            <div className="space-y-3">
              {pools.map((pool) => (
                <div key={pool.name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{pool.name}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-32">
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-2 rounded-full',
                            pool.capacity > 90 ? 'bg-red-500' : pool.capacity > 75 ? 'bg-yellow-500' : 'bg-emerald-500',
                          )}
                          style={{ width: `${Math.min(pool.capacity, 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-10 text-right text-xs text-muted-foreground">{pool.capacity}%</span>
                    <StatusBadge status={pool.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System info */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-lg font-semibold text-card-foreground mb-4">System Information</h3>
          {systemInfo ? (
            <div className="space-y-3">
              <SystemInfoRow icon={<Server className="h-4 w-4" />} label="Hostname" value={systemInfo.hostname} />
              <SystemInfoRow icon={<Cpu className="h-4 w-4" />} label="CPU" value={`${systemInfo.cpuModel} (${systemInfo.cpuCount} cores)`} />
              <SystemInfoRow icon={<MemoryStick className="h-4 w-4" />} label="Memory" value={`${formatBytes(systemInfo.freeMemory)} free / ${formatBytes(systemInfo.totalMemory)} total`} />
              <SystemInfoRow icon={<Clock className="h-4 w-4" />} label="Uptime" value={formatUptime(systemInfo.uptime)} />
              <SystemInfoRow icon={<Database className="h-4 w-4" />} label="ZFS Version" value={systemInfo.zfsVersion} />
              <SystemInfoRow icon={<Activity className="h-4 w-4" />} label="Load Average" value={systemInfo.loadAverage.map((l) => l.toFixed(2)).join(', ')} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading system information...</p>
          )}
        </div>
      </div>

      {/* Recent alerts */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-lg font-semibold text-card-foreground mb-4">Recent Alerts</h3>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent alerts</p>
        ) : (
          <div className="space-y-2">
            {alerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  'flex items-start justify-between rounded-md border p-3',
                  alert.severity === 'critical' ? 'border-red-500/30 bg-red-500/5' :
                  alert.severity === 'error' ? 'border-red-500/20 bg-red-500/5' :
                  alert.severity === 'warning' ? 'border-yellow-500/20 bg-yellow-500/5' :
                  'border-border',
                )}
              >
                <div className="flex items-start space-x-3">
                  <StatusBadge status={alert.severity} />
                  <div>
                    <p className="text-sm text-foreground">{alert.message}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
  variant = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  variant?: 'default' | 'primary' | 'destructive';
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center space-x-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className={cn(
        'mt-2 text-2xl font-bold',
        variant === 'destructive' ? 'text-destructive' : 'text-card-foreground',
      )}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function SystemInfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
