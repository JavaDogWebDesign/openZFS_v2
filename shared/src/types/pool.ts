export type PoolStatus = 'ONLINE' | 'DEGRADED' | 'FAULTED' | 'OFFLINE' | 'UNAVAIL' | 'REMOVED';

export type VdevType = 'disk' | 'file' | 'mirror' | 'raidz' | 'raidz1' | 'raidz2' | 'raidz3' | 'draid' | 'spare' | 'log' | 'cache' | 'special' | 'dedup';

export interface ScanInfo {
  function: 'scrub' | 'resilver' | 'trim' | 'none';
  state: 'scanning' | 'finished' | 'canceled' | 'none';
  startTime?: string;
  endTime?: string;
  percentage?: number;
  bytesIssued?: number;
  bytesTotal?: number;
  errors?: number;
  pauseTime?: string;
}

export interface VdevNode {
  name: string;
  type: VdevType;
  status: PoolStatus;
  guid?: string;
  path?: string;
  read_errors: number;
  write_errors: number;
  checksum_errors: number;
  children?: VdevNode[];
}

export interface Pool {
  name: string;
  guid: string;
  status: PoolStatus;
  size: number;
  allocated: number;
  free: number;
  fragmentation: number;
  capacity: number;
  dedupratio: number;
  health: string;
  altroot?: string;
}

export interface PoolDetail extends Pool {
  properties: Record<string, string>;
  vdevs: VdevNode[];
  scan?: ScanInfo;
  errors?: string;
  feature_flags?: Record<string, string>;
}
