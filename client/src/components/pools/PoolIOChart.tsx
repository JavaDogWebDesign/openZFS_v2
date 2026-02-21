import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Activity } from 'lucide-react';
import type { IOStatEntry } from '@zfs-manager/shared';
import { formatBytes } from '@/lib/formatBytes';
import { cn } from '@/lib/utils';
import { monitoringApi } from '@/api/endpoints';
import { useSocket } from '@/hooks/useSocket';

interface PoolIOChartProps {
  poolName: string;
}

interface ChartDataPoint {
  time: string;
  readOps: number;
  writeOps: number;
  readBandwidth: number;
  writeBandwidth: number;
}

type ChartView = 'iops' | 'bandwidth';

export function PoolIOChart({ poolName }: PoolIOChartProps) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [view, setView] = useState<ChartView>('iops');
  const [isLoading, setIsLoading] = useState(true);

  const { socket } = useSocket({ namespace: 'monitoring' });

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const result = await monitoringApi.iostat(poolName);
        if (result.success && result.data.length > 0) {
          const chartData: ChartDataPoint[] = result.data.map((entry, i) => ({
            time: entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : `${i * 2}s`,
            readOps: entry.readOps,
            writeOps: entry.writeOps,
            readBandwidth: entry.readBandwidth,
            writeBandwidth: entry.writeBandwidth,
          }));
          setData(chartData);
        }
      } catch {
        // Keep empty data on error
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, [poolName]);

  useEffect(() => {
    if (!socket) return;

    const handler = (entry: IOStatEntry) => {
      if (entry.pool !== poolName) return;
      const point: ChartDataPoint = {
        time: new Date(entry.timestamp).toLocaleTimeString(),
        readOps: entry.readOps,
        writeOps: entry.writeOps,
        readBandwidth: entry.readBandwidth,
        writeBandwidth: entry.writeBandwidth,
      };
      setData((prev) => {
        const updated = [...prev, point];
        return updated.length > 60 ? updated.slice(updated.length - 60) : updated;
      });
    };

    socket.on('iostat', handler);
    return () => {
      socket.off('iostat', handler);
    };
  }, [socket, poolName]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">I/O Statistics</h3>
          <span className="text-sm text-muted-foreground">- {poolName}</span>
        </div>

        <div className="flex rounded-md border border-border">
          <button
            onClick={() => setView('iops')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors',
              view === 'iops'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            IOPS
          </button>
          <button
            onClick={() => setView('bandwidth')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors border-l border-border',
              view === 'bandwidth'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Bandwidth
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading chart data...</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="time" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={view === 'bandwidth' ? (v) => formatBytes(v) : undefined}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number) =>
                  view === 'bandwidth' ? formatBytes(value) : value.toLocaleString()
                }
              />
              <Legend />
              {view === 'iops' ? (
                <>
                  <Line
                    type="monotone"
                    dataKey="readOps"
                    name="Read IOPS"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="writeOps"
                    name="Write IOPS"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    dot={false}
                  />
                </>
              ) : (
                <>
                  <Line
                    type="monotone"
                    dataKey="readBandwidth"
                    name="Read Bandwidth"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="writeBandwidth"
                    name="Write Bandwidth"
                    stroke="hsl(var(--chart-2))"
                    strokeWidth={2}
                    dot={false}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
