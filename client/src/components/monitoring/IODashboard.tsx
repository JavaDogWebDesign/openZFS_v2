import { useState, useEffect, useRef, useCallback } from 'react';
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
import { Activity, Wifi, WifiOff } from 'lucide-react';
import type { IOStatEntry, Pool } from '@zfs-manager/shared';
import { useSocket } from '@/hooks/useSocket';
import { formatBytes } from '@/lib/formatBytes';
import { cn } from '@/lib/utils';
import { poolApi } from '@/api/endpoints';

const MAX_DATA_POINTS = 60;

interface ChartData {
  time: string;
  readOps: number;
  writeOps: number;
  readBw: number;
  writeBw: number;
}

export function IODashboard() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [data, setData] = useState<ChartData[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const { socket, isConnected } = useSocket({ namespace: 'monitoring' });

  useEffect(() => {
    const fetchPools = async () => {
      try {
        const result = await poolApi.list();
        if (result.success) {
          setPools(result.data);
          if (result.data.length > 0) {
            setSelectedPool(result.data[0].name);
          }
        }
      } catch {
        // Keep defaults on error
      }
    };
    fetchPools();
  }, []);

  useEffect(() => {
    if (!socket || !selectedPool || isPaused) return;

    const handler = (entry: IOStatEntry) => {
      if (entry.pool !== selectedPool) return;

      const point: ChartData = {
        time: new Date(entry.timestamp).toLocaleTimeString(),
        readOps: entry.readOps,
        writeOps: entry.writeOps,
        readBw: entry.readBandwidth,
        writeBw: entry.writeBandwidth,
      };

      setData((prev) => {
        const updated = [...prev, point];
        if (updated.length > MAX_DATA_POINTS) {
          return updated.slice(updated.length - MAX_DATA_POINTS);
        }
        return updated;
      });
    };

    socket.on('iostat', handler);
    return () => {
      socket.off('iostat', handler);
    };
  }, [socket, selectedPool, isPaused]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground">I/O Dashboard</h2>
          <div className="flex items-center space-x-1">
            {isConnected ? (
              <>
                <Wifi className="h-4 w-4 text-emerald-500" />
                <span className="text-xs text-emerald-500">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Disconnected</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Pool selector */}
          <select
            value={selectedPool ?? ''}
            onChange={(e) => {
              setSelectedPool(e.target.value);
              setData([]);
            }}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {pools.map((pool) => (
              <option key={pool.name} value={pool.name}>{pool.name}</option>
            ))}
          </select>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              isPaused
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border border-border text-foreground hover:bg-accent',
            )}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>

          <button
            onClick={() => setData([])}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* IOPS chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">IOPS</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="readOps" name="Read IOPS" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="writeOps" name="Write IOPS" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Bandwidth chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Bandwidth</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => formatBytes(v)} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number) => formatBytes(value)}
            />
            <Legend />
            <Line type="monotone" dataKey="readBw" name="Read BW" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="writeBw" name="Write BW" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {data.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
          <Activity className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            {isConnected
              ? 'Waiting for I/O data...'
              : 'Connect to the server to see real-time I/O statistics'}
          </p>
        </div>
      )}
    </div>
  );
}
