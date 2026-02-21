import { useState } from 'react';
import { Layers, ChevronRight, ChevronDown, FolderOpen, Settings } from 'lucide-react';
import type { Dataset } from '@zfs-manager/shared';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/formatBytes';

interface DatasetListProps {
  datasets: Dataset[];
  isLoading: boolean;
  onSelect?: (dataset: Dataset) => void;
  onEdit?: (dataset: Dataset) => void;
}

/**
 * Build a hierarchical tree structure from the flat dataset list.
 */
interface DatasetNode {
  dataset: Dataset;
  children: DatasetNode[];
}

function buildTree(datasets: Dataset[]): DatasetNode[] {
  const nodeMap = new Map<string, DatasetNode>();
  const roots: DatasetNode[] = [];

  // Create all nodes
  for (const ds of datasets) {
    nodeMap.set(ds.name, { dataset: ds, children: [] });
  }

  // Build tree
  for (const ds of datasets) {
    const node = nodeMap.get(ds.name)!;
    const lastSlash = ds.name.lastIndexOf('/');
    if (lastSlash === -1) {
      roots.push(node);
    } else {
      const parentName = ds.name.substring(0, lastSlash);
      const parent = nodeMap.get(parentName);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
  }

  return roots;
}

export function DatasetList({ datasets, isLoading, onSelect, onEdit }: DatasetListProps) {
  const tree = buildTree(datasets);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  if (datasets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
        <Layers className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium text-foreground">No datasets found</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a pool first, then create datasets within it.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* Table header */}
      <div className="grid grid-cols-12 gap-2 border-b border-border bg-muted/50 px-4 py-3 text-sm font-medium text-muted-foreground">
        <div className="col-span-4">Name</div>
        <div className="col-span-2 text-right">Used</div>
        <div className="col-span-2 text-right">Available</div>
        <div className="col-span-1 text-right">Ratio</div>
        <div className="col-span-2">Mountpoint</div>
        <div className="col-span-1 text-right">Actions</div>
      </div>

      {/* Tree rows */}
      <div>
        {tree.map((node) => (
          <DatasetTreeRow
            key={node.dataset.name}
            node={node}
            depth={0}
            onSelect={onSelect}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  );
}

function DatasetTreeRow({
  node,
  depth,
  onSelect,
  onEdit,
}: {
  node: DatasetNode;
  depth: number;
  onSelect?: (dataset: Dataset) => void;
  onEdit?: (dataset: Dataset) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const ds = node.dataset;
  const hasChildren = node.children.length > 0;
  const shortName = ds.name.split('/').pop() || ds.name;

  return (
    <>
      <div
        className="grid grid-cols-12 gap-2 border-b border-border px-4 py-2.5 text-sm hover:bg-muted/30 cursor-pointer transition-colors last:border-0"
        onClick={() => onSelect?.(ds)}
      >
        <div className="col-span-4 flex items-center" style={{ paddingLeft: `${depth * 20}px` }}>
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="mr-1 rounded p-0.5 hover:bg-accent"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="mr-1 w-5" />
          )}
          <FolderOpen className="mr-2 h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-foreground">{shortName}</span>
          {ds.compression && ds.compression !== 'off' && (
            <span className="ml-2 rounded bg-blue-500/10 px-1.5 py-0.5 text-xs text-blue-500">
              {ds.compression}
            </span>
          )}
        </div>
        <div className="col-span-2 text-right text-foreground">{formatBytes(ds.used)}</div>
        <div className="col-span-2 text-right text-foreground">{formatBytes(ds.available)}</div>
        <div className="col-span-1 text-right text-muted-foreground">{ds.compressratio.toFixed(2)}x</div>
        <div className="col-span-2 truncate font-mono text-xs text-muted-foreground">
          {ds.mountpoint || '-'}
        </div>
        <div className="col-span-1 flex justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(ds);
            }}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            title="Edit properties"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
      {hasChildren && expanded &&
        node.children.map((child) => (
          <DatasetTreeRow
            key={child.dataset.name}
            node={child}
            depth={depth + 1}
            onSelect={onSelect}
            onEdit={onEdit}
          />
        ))}
    </>
  );
}
