import { HardDrive, ChevronRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { VdevNode } from '@zfs-manager/shared';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/common/StatusBadge';

interface VdevTreeProps {
  vdevs: VdevNode[];
}

export function VdevTree({ vdevs }: VdevTreeProps) {
  if (vdevs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No vdev information available.</p>
    );
  }

  return (
    <div className="space-y-1">
      {vdevs.map((vdev, idx) => (
        <VdevNodeRow key={vdev.guid ?? idx} node={vdev} depth={0} />
      ))}
    </div>
  );
}

interface VdevNodeRowProps {
  node: VdevNode;
  depth: number;
}

function VdevNodeRow({ node, depth }: VdevNodeRowProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isLeaf = !hasChildren;
  const hasErrors = node.read_errors > 0 || node.write_errors > 0 || node.checksum_errors > 0;

  return (
    <div>
      <div
        className={cn(
          'flex items-center rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors',
          hasErrors && 'bg-destructive/5',
        )}
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
      >
        {/* Expand/collapse */}
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
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

        {/* Icon */}
        <HardDrive className={cn('mr-2 h-4 w-4', isLeaf ? 'text-muted-foreground' : 'text-primary')} />

        {/* Name */}
        <span className={cn('text-sm font-medium', isLeaf ? 'text-foreground' : 'text-primary')}>
          {node.name}
        </span>

        {/* Type badge */}
        {!isLeaf && (
          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {node.type}
          </span>
        )}

        {/* Status */}
        <div className="ml-auto flex items-center space-x-4">
          <StatusBadge status={node.status} />

          {/* Error counts */}
          <div className="flex space-x-3 text-xs text-muted-foreground">
            <span className={cn(node.read_errors > 0 && 'text-destructive')}>
              R:{node.read_errors}
            </span>
            <span className={cn(node.write_errors > 0 && 'text-destructive')}>
              W:{node.write_errors}
            </span>
            <span className={cn(node.checksum_errors > 0 && 'text-destructive')}>
              C:{node.checksum_errors}
            </span>
          </div>
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {node.children!.map((child, idx) => (
            <VdevNodeRow key={child.guid ?? idx} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
