export interface IOStatEntry {
  pool: string;
  timestamp: number;
  readOps: number;
  writeOps: number;
  readBandwidth: number;
  writeBandwidth: number;
  readLatency?: number;
  writeLatency?: number;
}

export interface ARCStats {
  hits: number;
  misses: number;
  hitRatio: number;
  size: number;
  maxSize: number;
  mruSize: number;
  mfuSize: number;
  l2Hits?: number;
  l2Misses?: number;
  l2Size?: number;
}

export interface ScrubStatus {
  pool: string;
  state: 'running' | 'finished' | 'canceled' | 'none';
  startTime?: string;
  endTime?: string;
  percentage?: number;
  scanned?: number;
  issued?: number;
  total?: number;
  speed?: number;
  errors?: number;
  timeRemaining?: string;
  paused?: boolean;
}

export interface TrimStatus {
  pool: string;
  state: 'running' | 'finished' | 'suspended' | 'none';
  percentage?: number;
  startTime?: string;
}

export interface ScrubSchedule {
  id: string;
  pool: string;
  cronExpression: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

export interface TrimSchedule {
  id: string;
  pool: string;
  cronExpression: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

export interface ScrubHistoryEntry {
  pool: string;
  startTime: string;
  endTime: string;
  bytesScanned: number;
  bytesIssued: number;
  errors: number;
  duration: number;
}

export interface TrimHistoryEntry {
  pool: string;
  startTime: string;
  endTime?: string;
  state: string;
}
