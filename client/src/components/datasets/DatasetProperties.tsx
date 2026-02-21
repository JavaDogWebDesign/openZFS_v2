import { useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import type { Dataset, Property } from '@zfs-manager/shared';
import { ZFS_DATASET_PROPERTIES, ZFS_READONLY_PROPERTIES } from '@zfs-manager/shared';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/formatBytes';
import { datasetApi } from '@/api/endpoints';

interface DatasetPropertiesProps {
  dataset: Dataset;
  onSave?: (name: string, properties: Record<string, string>) => void;
}

export function DatasetProperties({ dataset, onSave }: DatasetPropertiesProps) {
  const [editedProps, setEditedProps] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = Object.keys(editedProps).length > 0;

  const handleChange = (name: string, value: string) => {
    setEditedProps((prev) => ({ ...prev, [name]: value }));
  };

  const handleReset = () => {
    setEditedProps({});
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    setIsSaving(true);
    try {
      const result = await datasetApi.update(dataset.name, editedProps);
      if (result.success) {
        onSave?.(dataset.name, editedProps);
        setEditedProps({});
      }
    } catch {
      // Error handled by API client
    } finally {
      setIsSaving(false);
    }
  };

  const properties = dataset.properties ?? {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Properties: {dataset.name}</h3>
        {hasChanges && (
          <div className="flex space-x-2">
            <button
              onClick={handleReset}
              className="flex items-center space-x-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center space-x-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Save className="h-3 w-3" />
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Property</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Value</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Source</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
            </tr>
          </thead>
          <tbody>
            {/* Editable properties */}
            {ZFS_DATASET_PROPERTIES.filter((p) => p.applies.includes(dataset.type as 'filesystem' | 'volume')).map(
              (propDef) => {
                const currentProp = properties[propDef.name];
                const currentValue = editedProps[propDef.name] ?? currentProp?.value ?? propDef.default ?? '';
                const isEdited = propDef.name in editedProps;

                return (
                  <tr
                    key={propDef.name}
                    className={cn(
                      'border-b border-border last:border-0',
                      isEdited && 'bg-primary/5',
                    )}
                  >
                    <td className="px-4 py-2 font-mono text-xs text-foreground">{propDef.name}</td>
                    <td className="px-4 py-2">
                      {propDef.type === 'enum' && propDef.values ? (
                        <select
                          value={currentValue}
                          onChange={(e) => handleChange(propDef.name, e.target.value)}
                          className="rounded border border-input bg-background px-2 py-1 text-xs focus:border-ring focus:outline-none"
                        >
                          {propDef.values.map((v) => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={currentValue}
                          onChange={(e) => handleChange(propDef.name, e.target.value)}
                          className="w-full rounded border border-input bg-background px-2 py-1 text-xs focus:border-ring focus:outline-none"
                        />
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {currentProp?.source ?? 'default'}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{propDef.description}</td>
                  </tr>
                );
              },
            )}

            {/* Read-only properties */}
            {ZFS_READONLY_PROPERTIES.map((propName) => {
              const prop = properties[propName];
              if (!prop) return null;
              return (
                <tr key={propName} className="border-b border-border last:border-0 bg-muted/20">
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{propName}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{prop.value}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{prop.source}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground italic">Read-only</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
