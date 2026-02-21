import type { WizardState } from '../RaidWizard';

interface DatasetSetupProps {
  state: WizardState;
  onUpdate: (updates: Partial<WizardState>) => void;
}

export function DatasetSetup({ state, onUpdate }: DatasetSetupProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Initial Dataset</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Optionally create an initial dataset in your new pool. You can skip this step
          and create datasets later.
        </p>
      </div>

      {/* Dataset name */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Dataset Name</label>
        <div className="flex items-center space-x-1">
          <span className="text-sm text-muted-foreground">{state.poolName || '<pool>'}/</span>
          <input
            type="text"
            value={state.datasetName}
            onChange={(e) => onUpdate({ datasetName: e.target.value })}
            placeholder="data (optional)"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Leave empty to skip initial dataset creation. A root dataset is always created with the pool.
        </p>
      </div>

      {state.datasetName && (
        <>
          {/* Compression */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Compression</label>
            <select
              value={state.datasetCompression}
              onChange={(e) => onUpdate({ datasetCompression: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="inherit">Inherit from pool</option>
              <option value="lz4">LZ4</option>
              <option value="zstd">ZSTD</option>
              <option value="gzip">GZIP</option>
              <option value="off">Off</option>
            </select>
          </div>

          {/* Quota */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Quota <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={state.datasetQuota}
              onChange={(e) => onUpdate({ datasetQuota: e.target.value })}
              placeholder="e.g., 500G or 2T"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Limit the maximum amount of space this dataset can use. Leave empty for no limit.
            </p>
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-muted/50 p-4">
            <h4 className="text-sm font-medium text-foreground mb-2">Dataset Preview</h4>
            <div className="space-y-1 text-xs text-muted-foreground font-mono">
              <p>Name: {state.poolName}/{state.datasetName}</p>
              <p>Mountpoint: /{state.poolName}/{state.datasetName}</p>
              <p>Compression: {state.datasetCompression}</p>
              {state.datasetQuota && <p>Quota: {state.datasetQuota}</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
