import { useState, useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  Filter,
  RefreshCw,
} from 'lucide-react';
import type { Alert, AlertSeverity, AlertCategory } from '@zfs-manager/shared';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/common/StatusBadge';

interface AlertsPanelProps {
  alerts?: Alert[];
  isLoading?: boolean;
  onAcknowledge?: (id: string) => void;
  onRefresh?: () => void;
}

const severityIcons: Record<AlertSeverity, React.ReactNode> = {
  info: <Info className="h-4 w-4 text-blue-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  error: <AlertOctagon className="h-4 w-4 text-red-500" />,
  critical: <AlertOctagon className="h-4 w-4 text-red-600" />,
};

type SeverityFilter = AlertSeverity | 'all';

export function AlertsPanel({ alerts = [], isLoading = false, onAcknowledge, onRefresh }: AlertsPanelProps) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [showAcknowledged, setShowAcknowledged] = useState(false);

  const filtered = alerts.filter((alert) => {
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
    if (!showAcknowledged && alert.acknowledged) return false;
    return true;
  });

  const counts = {
    all: alerts.filter((a) => showAcknowledged || !a.acknowledged).length,
    critical: alerts.filter((a) => a.severity === 'critical' && (showAcknowledged || !a.acknowledged)).length,
    error: alerts.filter((a) => a.severity === 'error' && (showAcknowledged || !a.acknowledged)).length,
    warning: alerts.filter((a) => a.severity === 'warning' && (showAcknowledged || !a.acknowledged)).length,
    info: alerts.filter((a) => a.severity === 'info' && (showAcknowledged || !a.acknowledged)).length,
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Alerts</h2>
          {counts.critical > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-medium text-white">
              {counts.critical}
            </span>
          )}
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center space-x-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-1 rounded-md border border-border p-1">
          {(['all', 'critical', 'error', 'warning', 'info'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setSeverityFilter(filter)}
              className={cn(
                'rounded px-3 py-1 text-xs font-medium transition-colors',
                severityFilter === filter
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
              {counts[filter] > 0 && (
                <span className="ml-1 text-[10px]">({counts[filter]})</span>
              )}
            </button>
          ))}
        </div>

        <label className="flex items-center space-x-2 text-sm">
          <input
            type="checkbox"
            checked={showAcknowledged}
            onChange={(e) => setShowAcknowledged(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          <span className="text-muted-foreground">Show acknowledged</span>
        </label>
      </div>

      {/* Alert list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
          <CheckCircle2 className="h-10 w-10 text-emerald-500/50" />
          <p className="mt-3 text-sm text-muted-foreground">No alerts to display</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                'rounded-lg border p-4 transition-colors',
                alert.acknowledged && 'opacity-60',
                alert.severity === 'critical' ? 'border-red-500/30 bg-red-500/5' :
                alert.severity === 'error' ? 'border-red-500/20 bg-red-500/5' :
                alert.severity === 'warning' ? 'border-yellow-500/20 bg-yellow-500/5' :
                'border-border bg-card',
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="mt-0.5">{severityIcons[alert.severity]}</div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <StatusBadge status={alert.severity} />
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {alert.category}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-foreground">{alert.message}</p>
                    {alert.details && (
                      <p className="mt-1 text-xs text-muted-foreground">{alert.details}</p>
                    )}
                    <div className="mt-2 flex items-center space-x-3 text-xs text-muted-foreground">
                      <span>{new Date(alert.timestamp).toLocaleString()}</span>
                      {alert.pool && <span>Pool: {alert.pool}</span>}
                      {alert.device && <span>Device: {alert.device}</span>}
                    </div>
                  </div>
                </div>

                {!alert.acknowledged && (
                  <button
                    onClick={() => onAcknowledge?.(alert.id)}
                    className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
                  >
                    Acknowledge
                  </button>
                )}

                {alert.acknowledged && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Ack by {alert.acknowledgedBy}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
