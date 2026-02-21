import { useState, useEffect } from 'react';
import { Database, RefreshCw } from 'lucide-react';
import type { ARCStats as ARCStatsType } from '@zfs-manager/shared';
import { formatBytes } from '@/lib/formatBytes';
import { cn } from '@/lib/utils';
import { monitoringApi } from '@/api/endpoints';

export function ARCStats() {
  const [stats, setStats] = useState<ARCStatsType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const result = await monitoringApi.arc();
      if (result.success) {
        setStats(result.data);
      }
    } catch {
      // Keep previous stats on error
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !stats) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  const hitRatioPercent = (stats.hitRatio * 100).toFixed(1);
  const sizePercent = stats.maxSize > 0 ? (stats.size / stats.maxSize) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground">ARC Statistics</h2>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center space-x-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Hit ratio gauge */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">Hit Ratio</h3>
        <div className="flex items-center space-x-8">
          {/* Circular gauge */}
          <div className="relative h-32 w-32">
            <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
              {/* Background circle */}
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                strokeWidth="12"
                className="stroke-muted"
              />
              {/* Progress circle */}
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                strokeWidth="12"
                strokeDasharray={`${stats.hitRatio * 339.292} 339.292`}
                strokeLinecap="round"
                className={cn(
                  stats.hitRatio > 0.9 ? 'stroke-emerald-500' :
                  stats.hitRatio > 0.7 ? 'stroke-yellow-500' : 'stroke-red-500',
                )}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-foreground">{hitRatioPercent}%</span>
            </div>
          </div>

          <div className="space-y-2">
            <StatRow label="Total Hits" value={stats.hits.toLocaleString()} />
            <StatRow label="Total Misses" value={stats.misses.toLocaleString()} />
            <StatRow
              label="Hit Ratio"
              value={`${hitRatioPercent}%`}
              variant={stats.hitRatio > 0.9 ? 'success' : stats.hitRatio > 0.7 ? 'warning' : 'error'}
            />
          </div>
        </div>
      </div>

      {/* ARC Size */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">ARC Size</h3>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="text-muted-foreground">Current / Maximum</span>
              <span className="font-medium text-foreground">
                {formatBytes(stats.size)} / {formatBytes(stats.maxSize)}
              </span>
            </div>
            <div className="h-4 rounded-full bg-muted">
              <div
                className="h-4 rounded-full bg-blue-500 transition-all"
                style={{ width: `${Math.min(sizePercent, 100)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">MRU (Most Recently Used)</p>
              <p className="mt-1 text-lg font-bold text-foreground">{formatBytes(stats.mruSize)}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">MFU (Most Frequently Used)</p>
              <p className="mt-1 text-lg font-bold text-foreground">{formatBytes(stats.mfuSize)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* L2ARC */}
      {stats.l2Size != null && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">L2ARC (SSD Cache)</h3>
          <div className="space-y-2">
            <StatRow label="L2 Size" value={formatBytes(stats.l2Size)} />
            <StatRow label="L2 Hits" value={(stats.l2Hits ?? 0).toLocaleString()} />
            <StatRow label="L2 Misses" value={(stats.l2Misses ?? 0).toLocaleString()} />
            {(stats.l2Hits ?? 0) + (stats.l2Misses ?? 0) > 0 && (
              <StatRow
                label="L2 Hit Ratio"
                value={`${(((stats.l2Hits ?? 0) / ((stats.l2Hits ?? 0) + (stats.l2Misses ?? 0))) * 100).toFixed(1)}%`}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant?: 'success' | 'warning' | 'error';
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          'font-medium',
          variant === 'success' ? 'text-emerald-500' :
          variant === 'warning' ? 'text-yellow-500' :
          variant === 'error' ? 'text-red-500' :
          'text-foreground',
        )}
      >
        {value}
      </span>
    </div>
  );
}
