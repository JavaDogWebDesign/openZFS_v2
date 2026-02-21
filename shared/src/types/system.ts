export interface SystemInfo {
  hostname: string;
  platform: string;
  arch: string;
  kernelVersion: string;
  uptime: number;
  loadAverage: [number, number, number];
  totalMemory: number;
  freeMemory: number;
  cpuCount: number;
  cpuModel: string;
  zfsVersion: string;
  zfsModuleVersion?: string;
}
