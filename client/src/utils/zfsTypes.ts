import type { PoolStatus } from '@zfs-manager/shared';

/**
 * Color mapping for ZFS pool status values.
 */
export const STATUS_COLORS: Record<PoolStatus, string> = {
  ONLINE: 'text-emerald-500',
  DEGRADED: 'text-yellow-500',
  FAULTED: 'text-red-500',
  OFFLINE: 'text-zinc-500',
  UNAVAIL: 'text-red-400',
  REMOVED: 'text-zinc-400',
};

/**
 * Background color mapping for status values.
 */
export const STATUS_BG_COLORS: Record<PoolStatus, string> = {
  ONLINE: 'bg-emerald-500/15',
  DEGRADED: 'bg-yellow-500/15',
  FAULTED: 'bg-red-500/15',
  OFFLINE: 'bg-zinc-500/15',
  UNAVAIL: 'bg-red-500/15',
  REMOVED: 'bg-zinc-500/15',
};

/**
 * Human-readable status descriptions.
 */
export const STATUS_DESCRIPTIONS: Record<PoolStatus, string> = {
  ONLINE: 'The pool is healthy and all vdevs are operational.',
  DEGRADED: 'The pool is functional but some vdevs have issues. Data is at risk.',
  FAULTED: 'The pool is in a faulted state and cannot be accessed.',
  OFFLINE: 'The pool has been taken offline.',
  UNAVAIL: 'The pool is unavailable, possibly due to missing devices.',
  REMOVED: 'The pool device has been physically removed.',
};

/**
 * Common compression algorithms with descriptions.
 */
export const COMPRESSION_OPTIONS = [
  { value: 'off', label: 'Off', description: 'No compression' },
  { value: 'on', label: 'On', description: 'Default compression algorithm' },
  { value: 'lz4', label: 'LZ4', description: 'Fast compression, good ratio (recommended)' },
  { value: 'zstd', label: 'ZSTD', description: 'Better ratio, moderate CPU usage' },
  { value: 'gzip', label: 'GZIP', description: 'Best ratio, highest CPU usage' },
  { value: 'gzip-1', label: 'GZIP-1', description: 'Fastest gzip level' },
  { value: 'gzip-9', label: 'GZIP-9', description: 'Best gzip compression' },
  { value: 'zle', label: 'ZLE', description: 'Zero-length encoding only' },
  { value: 'lzjb', label: 'LZJB', description: 'Legacy algorithm' },
] as const;

/**
 * Record size options.
 */
export const RECORD_SIZE_OPTIONS = [
  { value: '4096', label: '4K', description: 'Small random I/O (databases)' },
  { value: '8192', label: '8K', description: 'Small blocks' },
  { value: '16384', label: '16K', description: 'Mixed workloads' },
  { value: '32768', label: '32K', description: 'General purpose' },
  { value: '65536', label: '64K', description: 'Balanced' },
  { value: '131072', label: '128K', description: 'Default - good for most workloads' },
  { value: '262144', label: '256K', description: 'Large sequential I/O' },
  { value: '524288', label: '512K', description: 'Very large sequential I/O' },
  { value: '1048576', label: '1M', description: 'Maximum - large file streaming' },
] as const;

/**
 * Shell options for user creation.
 */
export const SHELL_OPTIONS = [
  { value: '/bin/bash', label: 'Bash' },
  { value: '/bin/zsh', label: 'Zsh' },
  { value: '/bin/sh', label: 'Sh' },
  { value: '/usr/sbin/nologin', label: 'No Login' },
  { value: '/bin/false', label: 'False' },
] as const;
