export interface Partition {
  name: string;
  size: number;
  type: string;
  mountpoint?: string;
  fstype?: string;
  label?: string;
  uuid?: string;
}

export interface Disk {
  name: string;
  path: string;
  byIdPath?: string;
  model: string;
  serial: string;
  size: number;
  type: 'disk' | 'ssd' | 'nvme';
  rotational: boolean;
  vendor: string;
  transport: string;
  wwn?: string;
  partitions: Partition[];
  inUse: boolean;
  pool?: string;
  health?: string;
  temperature?: number;
}

export interface SMARTAttribute {
  id: number;
  name: string;
  value: number;
  worst: number;
  threshold: number;
  rawValue: string;
  type: string;
  updated: string;
  whenFailed: string;
}

export interface SMARTData {
  device: string;
  healthy: boolean;
  temperature?: number;
  powerOnHours?: number;
  reallocatedSectors?: number;
  attributes: SMARTAttribute[];
  selfTestStatus?: string;
  overallAssessment: 'PASSED' | 'FAILED' | 'UNKNOWN';
}
