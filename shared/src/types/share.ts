export interface SMBShare {
  name: string;
  path: string;
  comment?: string;
  browseable: boolean;
  readonly: boolean;
  guestOk: boolean;
  validUsers?: string[];
  invalidUsers?: string[];
  writeList?: string[];
  createMask?: string;
  directoryMask?: string;
  forceUser?: string;
  forceGroup?: string;
  vfsObjects?: string[];
  recycleRepository?: string;
  enabled: boolean;
}

export interface NFSAccessRule {
  host: string;
  options: string[];
}

export interface NFSShare {
  path: string;
  enabled: boolean;
  rules: NFSAccessRule[];
  comment?: string;
}
