import { useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PoolDetail as PoolDetailType } from '@zfs-manager/shared';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatBytes } from '@/lib/formatBytes';
import { VdevTree } from './VdevTree';
import { PoolIOChart } from './PoolIOChart';
import { ScrubManager } from './ScrubManager';
import { TrimManager } from './TrimManager';

interface PoolDetailProps {
  pool: PoolDetailType | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

type Tab = 'overview' | 'io' | 'scrub' | 'trim' | 'properties';

export function PoolDetail({ pool, isLoading, error, onRefresh }: PoolDetailProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (error || !pool) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
        <p className="text-destructive">{error || 'Pool not found'}</p>
        <Link to="/pools" className="mt-2 inline-flex items-center text-sm text-primary hover:underline">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to pools
        </Link>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'io', label: 'I/O Statistics' },
    { id: 'scrub', label: 'Scrub' },
    { id: 'trim', label: 'TRIM' },
    { id: 'properties', label: 'Properties' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/pools" className="rounded-md p-1 hover:bg-accent">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{pool.name}</h1>
            <div className="mt-1 flex items-center space-x-3">
              <StatusBadge status={pool.status} />
              <span className="text-sm text-muted-foreground">
                {formatBytes(pool.allocated)} / {formatBytes(pool.size)} ({pool.capacity}% used)
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center space-x-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total Size" value={formatBytes(pool.size)} />
        <SummaryCard label="Allocated" value={formatBytes(pool.allocated)} />
        <SummaryCard label="Free" value={formatBytes(pool.free)} />
        <SummaryCard label="Dedup Ratio" value={`${pool.dedupratio.toFixed(2)}x`} />
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex space-x-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-lg font-semibold text-card-foreground mb-4">VDEV Topology</h3>
              <VdevTree vdevs={pool.vdevs} />
            </div>

            {pool.scan && (
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-lg font-semibold text-card-foreground mb-2">Last Scan</h3>
                <p className="text-sm text-muted-foreground">
                  {pool.scan.function} - {pool.scan.state}
                  {pool.scan.percentage != null && ` (${pool.scan.percentage.toFixed(1)}%)`}
                </p>
              </div>
            )}

            {pool.errors && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <p className="text-sm text-destructive">{pool.errors}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'io' && <PoolIOChart poolName={pool.name} />}
        {activeTab === 'scrub' && <ScrubManager poolName={pool.name} />}
        {activeTab === 'trim' && <TrimManager poolName={pool.name} />}

        {activeTab === 'properties' && (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Property</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(pool.properties).map(([key, value]) => (
                  <tr key={key} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{key}</td>
                    <td className="px-4 py-2 font-mono text-xs text-foreground">{value}</td>
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-card-foreground">{value}</p>
    </div>
  );
}
