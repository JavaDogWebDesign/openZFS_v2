export type DatasetType = 'filesystem' | 'volume' | 'snapshot' | 'bookmark';

export interface Property {
  value: string;
  source: 'local' | 'default' | 'inherited' | 'temporary' | 'received' | 'none' | '-';
}

export interface Dataset {
  name: string;
  type: DatasetType;
  pool: string;
  mountpoint?: string;
  used: number;
  available: number;
  referenced: number;
  compressratio: number;
  compression: string;
  quota: number;
  reservation: number;
  recordsize: number;
  atime: string;
  encryption?: string;
  keystatus?: string;
  properties?: Record<string, Property>;
}
