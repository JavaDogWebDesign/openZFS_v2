import { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import type { Dataset } from '@zfs-manager/shared';
import { datasetApi } from '@/api/endpoints';
import { DatasetList } from '@/components/datasets/DatasetList';
import { DatasetCreate } from '@/components/datasets/DatasetCreate';
import { DatasetProperties } from '@/components/datasets/DatasetProperties';

export function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingDataset, setEditingDataset] = useState<Dataset | null>(null);

  const fetchDatasets = useCallback(async () => {
    setIsLoading(true);
    const result = await datasetApi.list();
    if (result.success) {
      setDatasets(result.data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  const refetch = () => {
    fetchDatasets();
  };

  const parentDatasets = datasets.map((d) => d.name);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Datasets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage ZFS datasets, set properties, and configure quotas
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center space-x-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Create Dataset</span>
        </button>
      </div>

      {editingDataset ? (
        <div>
          <button
            onClick={() => setEditingDataset(null)}
            className="mb-4 text-sm text-primary hover:underline"
          >
            &larr; Back to list
          </button>
          <DatasetProperties
            dataset={editingDataset}
            onSave={() => {
              setEditingDataset(null);
              refetch();
            }}
          />
        </div>
      ) : (
        <DatasetList
          datasets={datasets}
          isLoading={isLoading}
          onEdit={(ds) => setEditingDataset(ds)}
        />
      )}

      <DatasetCreate
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={refetch}
        parentDatasets={parentDatasets}
      />
    </div>
  );
}
