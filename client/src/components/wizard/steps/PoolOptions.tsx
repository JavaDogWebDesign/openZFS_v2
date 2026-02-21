import type { WizardState } from '../RaidWizard';

interface PoolOptionsProps {
  state: WizardState;
  onUpdate: (updates: Partial<WizardState>) => void;
}

export function PoolOptions({ state, onUpdate }: PoolOptionsProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Pool Options</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the name and advanced options for your new pool.
        </p>
      </div>

      {/* Pool name */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Pool Name</label>
        <input
          type="text"
          value={state.poolName}
          onChange={(e) => onUpdate({ poolName: e.target.value })}
          placeholder="mypool"
          required
          pattern="[a-zA-Z][a-zA-Z0-9_.-]*"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Must start with a letter. Allowed: letters, digits, underscores, hyphens, periods.
        </p>
      </div>

      {/* Ashift */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Sector Size (ashift)
        </label>
        <select
          value={state.ashift}
          onChange={(e) => onUpdate({ ashift: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="0">Auto-detect</option>
          <option value="9">512 bytes (ashift=9)</option>
          <option value="12">4K (ashift=12) - recommended</option>
          <option value="13">8K (ashift=13)</option>
          <option value="14">16K (ashift=14)</option>
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          Match to physical sector size. Most modern drives use 4K sectors.
          Setting too low can hurt performance; too high wastes space.
        </p>
      </div>

      {/* Compression */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Default Compression
        </label>
        <select
          value={state.compression}
          onChange={(e) => onUpdate({ compression: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="off">Off</option>
          <option value="on">On (default algorithm)</option>
          <option value="lz4">LZ4 (recommended - fast, good ratio)</option>
          <option value="zstd">ZSTD (better ratio, more CPU)</option>
          <option value="gzip">GZIP (best ratio, highest CPU)</option>
          <option value="lzjb">LZJB (legacy)</option>
          <option value="zle">ZLE (zero-length encoding)</option>
        </select>
        <p className="mt-1 text-xs text-muted-foreground">
          LZ4 is recommended for most workloads. Compression can improve both capacity and performance.
        </p>
      </div>

      {/* Feature flags info */}
      <div className="rounded-lg bg-muted/50 p-4">
        <h4 className="text-sm font-medium text-foreground mb-2">Feature Flags</h4>
        <p className="text-xs text-muted-foreground">
          All feature flags will be enabled by default for new pools. This provides access to
          the latest ZFS features. Feature flags cannot be disabled once enabled.
        </p>
      </div>
    </div>
  );
}
