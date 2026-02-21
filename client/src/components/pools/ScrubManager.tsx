import { useState, useEffect } from 'react';
import { Play, Pause, Square, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ScrubStatus, ScrubSchedule, ScrubHistoryEntry } from '@zfs-manager/shared';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatBytes } from '@/lib/formatBytes';
import { poolApi } from '@/api/endpoints';

interface ScrubManagerProps {
  poolName: string;
}

export function ScrubManager({ poolName }: ScrubManagerProps) {
  const [status, setStatus] = useState<ScrubStatus | null>(null);
  const [schedule, setSchedule] = useState<ScrubSchedule | null>(null);
  const [history, setHistory] = useState<ScrubHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [statusResult, schedulesResult, historyResult] = await Promise.all([
          poolApi.getScrubStatus(poolName),
          poolApi.getScrubSchedules(),
          poolApi.getScrubHistory(poolName),
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
    const result = await poolApi.scrub(poolName, 'start');
    if (result.success) {
      setStatus(result.data);
    } else {
      setStatus((prev) => prev ? { ...prev, state: 'running', percentage: 0 } : prev);
    }
  };

  const handlePause = async () => {
    const result = await poolApi.scrub(poolName, 'pause');
    if (result.success) {
      setStatus(result.data);
    } else {
      setStatus((prev) => prev ? { ...prev, paused: true } : prev);
    }
  };

  const handleCancel = async () => {
    const result = await poolApi.scrub(poolName, 'cancel');
    if (result.success) {
      setStatus(result.data);
    } else {
      setStatus((prev) => prev ? { ...prev, state: 'canceled' } : prev);
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
          <h3 className="text-lg font-semibold text-card-foreground">Scrub Status</h3>
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
            {status.scanned != null && status.total != null && (
              <p className="text-xs text-muted-foreground">
                Scanned {formatBytes(status.scanned)} of {formatBytes(status.total)}
                {status.speed != null && ` at ${formatBytes(status.speed)}/s`}
                {status.timeRemaining && ` - ${status.timeRemaining} remaining`}
              </p>
            )}
            {(status.errors ?? 0) > 0 && (
              <div className="flex items-center space-x-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span>{status.errors} errors found</span>
              </div>
            )}
          </div>
        )}

        {status?.state === 'finished' && (
          <div className="flex items-center space-x-2 text-sm text-emerald-500">
            <CheckCircle2 className="h-4 w-4" />
            <span>
              Last scrub completed
              {status.endTime && ` at ${new Date(status.endTime).toLocaleString()}`}
              {status.errors === 0 ? ' with no errors' : ` with ${status.errors} errors`}
            </span>
          </div>
        )}

        {status?.state === 'none' && (
          <p className="text-sm text-muted-foreground">
            No scrub has been run on this pool yet.
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
              <span>Start Scrub</span>
            </button>
          )}
          {status?.state === 'running' && !status?.paused && (
            <button
              onClick={handlePause}
              className="flex items-center space-x-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              <Pause className="h-4 w-4" />
              <span>Pause</span>
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
          <p className="text-sm text-muted-foreground">No schedule configured for this pool.</p>
        )}
      </div>

      {/* History */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-lg font-semibold text-card-foreground mb-4">Scrub History</h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scrub history available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Start</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">End</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Scanned</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Errors</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Duration</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry, idx) => (
                  <tr key={idx} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-foreground">
                      {new Date(entry.startTime).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      {new Date(entry.endTime).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-foreground">{formatBytes(entry.bytesScanned)}</td>
                    <td className="px-3 py-2">
                      <span className={cn(entry.errors > 0 ? 'text-destructive' : 'text-emerald-500')}>
                        {entry.errors}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {Math.round(entry.duration / 60)}m
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
