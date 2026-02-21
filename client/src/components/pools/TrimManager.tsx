import { useState, useEffect } from 'react';
import { Play, Square, Clock, CheckCircle2 } from 'lucide-react';
import type { TrimStatus, TrimSchedule, TrimHistoryEntry } from '@zfs-manager/shared';
import { StatusBadge } from '@/components/common/StatusBadge';
import { poolApi } from '@/api/endpoints';

interface TrimManagerProps {
  poolName: string;
}

export function TrimManager({ poolName }: TrimManagerProps) {
  const [status, setStatus] = useState<TrimStatus | null>(null);
  const [schedule, setSchedule] = useState<TrimSchedule | null>(null);
  const [history, setHistory] = useState<TrimHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [statusResult, schedulesResult, historyResult] = await Promise.all([
          poolApi.getTrimStatus(poolName),
          poolApi.getTrimSchedules(),
          poolApi.getTrimHistory(poolName),
        ]);
        if (statusResult.success) {
          setStatus(statusResult.data);
        }
        if (schedulesResult.success) {
          const poolSchedule = schedulesResult.data.find((s) => s.pool === poolName) ?? null;
          setSchedule(poolSchedule);
        }
        if (historyResult.success) {
          setHistory(historyResult.data);
        }
      } catch {
        // Keep defaults on error
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [poolName]);

  const handleStart = async () => {
    const result = await poolApi.trim(poolName, 'start');
    if (result.success) {
      setStatus(result.data);
    } else {
      setStatus((prev) => prev ? { ...prev, state: 'running', percentage: 0 } : prev);
    }
  };

  const handleCancel = async () => {
    const result = await poolApi.trim(poolName, 'cancel');
    if (result.success) {
      setStatus(result.data);
    } else {
      setStatus((prev) => prev ? { ...prev, state: 'suspended' } : prev);
    }
  };

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-lg bg-muted" />;
  }

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-card-foreground">TRIM Status</h3>
          <StatusBadge status={status?.state ?? 'none'} />
        </div>

        {status?.state === 'running' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="text-foreground font-medium">
                {status.percentage?.toFixed(1) ?? 0}%
              </span>
            </div>
            <div className="h-3 rounded-full bg-muted">
              <div
                className="h-3 rounded-full bg-blue-500 transition-all"
                style={{ width: `${status.percentage ?? 0}%` }}
              />
            </div>
          </div>
        )}

        {status?.state === 'finished' && (
          <div className="flex items-center space-x-2 text-sm text-emerald-500">
            <CheckCircle2 className="h-4 w-4" />
            <span>TRIM completed successfully</span>
          </div>
        )}

        {status?.state === 'none' && (
          <p className="text-sm text-muted-foreground">
            No TRIM has been run on this pool yet. TRIM is only effective on SSD-based pools.
          </p>
        )}

        {/* Action buttons */}
        <div className="mt-4 flex space-x-3">
          {status?.state !== 'running' && (
            <button
              onClick={handleStart}
              className="flex items-center space-x-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Play className="h-4 w-4" />
              <span>Start TRIM</span>
            </button>
          )}
          {status?.state === 'running' && (
            <button
              onClick={handleCancel}
              className="flex items-center space-x-2 rounded-md border border-destructive/50 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Square className="h-4 w-4" />
              <span>Cancel</span>
            </button>
          )}
        </div>
      </div>

      {/* Schedule */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-card-foreground">Schedule</h3>
        </div>
        {schedule ? (
          <div className="text-sm">
            <p className="text-foreground">
              Cron: <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{schedule.cronExpression}</code>
            </p>
            {schedule.nextRun && (
              <p className="mt-1 text-muted-foreground">
                Next run: {new Date(schedule.nextRun).toLocaleString()}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No TRIM schedule configured for this pool.</p>
        )}
      </div>

      {/* History */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-lg font-semibold text-card-foreground mb-4">TRIM History</h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No TRIM history available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Start</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">End</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">State</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry, idx) => (
                  <tr key={idx} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-foreground">
                      {new Date(entry.startTime).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      {entry.endTime ? new Date(entry.endTime).toLocaleString() : '-'}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={entry.state} />
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
