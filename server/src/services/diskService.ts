/**
 * Disk discovery and SMART health service.
 *
 * Uses `lsblk` for enumeration and `smartctl` for health data.
 * All commands use execFile (never exec) to prevent shell injection.
 */

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import type { Disk, Partition, SMARTData, SMARTAttribute } from '@zfs-manager/shared';

const execFile = promisify(execFileCb);

// ---------------------------------------------------------------------------
// Disk enumeration
// ---------------------------------------------------------------------------

/** Raw shape returned by `lsblk --json` */
interface LsblkOutput {
  blockdevices: LsblkDevice[];
}

interface LsblkDevice {
  name: string;
  path: string;
  size: number | string;
  type: string;
  model?: string;
  serial?: string;
  vendor?: string;
  tran?: string;
  rota?: boolean;
  wwn?: string;
  fstype?: string;
  mountpoint?: string;
  label?: string;
  uuid?: string;
  children?: LsblkDevice[];
}

/**
 * List all block devices on the system.
 * Filters to whole disks (type === 'disk') by default.
 */
export async function listDisks(): Promise<Disk[]> {
  const { stdout } = await execFile('lsblk', [
    '--json',
    '--bytes',
    '--output', 'NAME,PATH,SIZE,TYPE,MODEL,SERIAL,VENDOR,TRAN,ROTA,WWN,FSTYPE,MOUNTPOINT,LABEL,UUID',
    '--nodeps',  // top-level devices only (no partitions at top level)
  ]);

  const parsed: LsblkOutput = JSON.parse(stdout);

  // Also get partition info with a second call (includes children)
  const { stdout: fullStdout } = await execFile('lsblk', [
    '--json',
    '--bytes',
    '--output', 'NAME,PATH,SIZE,TYPE,MODEL,SERIAL,VENDOR,TRAN,ROTA,WWN,FSTYPE,MOUNTPOINT,LABEL,UUID',
  ]);
  const fullParsed: LsblkOutput = JSON.parse(fullStdout);

  // Build a map of device name -> children from the full output
  const childrenMap = new Map<string, LsblkDevice[]>();
  for (const dev of fullParsed.blockdevices) {
    if (dev.children) {
      childrenMap.set(dev.name, dev.children);
    }
  }

  const disks: Disk[] = [];

  for (const dev of parsed.blockdevices) {
    if (dev.type !== 'disk') continue;

    const partitions: Partition[] = (childrenMap.get(dev.name) ?? []).map((child) => ({
      name: child.name,
      size: typeof child.size === 'string' ? parseInt(child.size, 10) : (child.size ?? 0),
      type: child.type ?? 'part',
      mountpoint: child.mountpoint ?? undefined,
      fstype: child.fstype ?? undefined,
      label: child.label ?? undefined,
      uuid: child.uuid ?? undefined,
    }));

    // Determine disk type from transport
    let diskType: 'disk' | 'ssd' | 'nvme' = 'disk';
    if (dev.tran === 'nvme') {
      diskType = 'nvme';
    } else if (dev.rota === false) {
      diskType = 'ssd';
    }

    // Determine if disk is in use by ZFS (basic heuristic: has zfs_member fstype)
    const inUse = partitions.some((p) => p.fstype === 'zfs_member') ||
      dev.fstype === 'zfs_member';

    disks.push({
      name: dev.name,
      path: dev.path ?? `/dev/${dev.name}`,
      model: dev.model?.trim() ?? 'Unknown',
      serial: dev.serial?.trim() ?? 'Unknown',
      size: typeof dev.size === 'string' ? parseInt(dev.size, 10) : (dev.size ?? 0),
      type: diskType,
      rotational: dev.rota ?? true,
      vendor: dev.vendor?.trim() ?? 'Unknown',
      transport: dev.tran ?? 'unknown',
      wwn: dev.wwn ?? undefined,
      partitions,
      inUse,
    });
  }

  return disks;
}

/**
 * Get detailed info for a single disk by name (e.g. "sda").
 */
export async function getDiskDetail(diskName: string): Promise<Disk | null> {
  const disks = await listDisks();
  return disks.find((d) => d.name === diskName) ?? null;
}

// ---------------------------------------------------------------------------
// SMART data
// ---------------------------------------------------------------------------

/**
 * Retrieve SMART data for a device using smartctl.
 *
 * @param devicePath - Full path like /dev/sda
 */
export async function getSmartData(devicePath: string): Promise<SMARTData> {
  let stdout: string;

  try {
    const result = await execFile('smartctl', [
      '--json',
      '--all',
      devicePath,
    ]);
    stdout = result.stdout;
  } catch (err: unknown) {
    // smartctl exits with non-zero for various reasons (e.g. bit flags for
    // disk issues), but still produces valid JSON. Try to parse anyway.
    const error = err as { stdout?: string; stderr?: string };
    if (error.stdout) {
      stdout = error.stdout;
    } else {
      return createUnknownSmartData(devicePath);
    }
  }

  try {
    const json = JSON.parse(stdout) as SmartctlJson;
    return mapSmartctlJson(devicePath, json);
  } catch {
    return createUnknownSmartData(devicePath);
  }
}

/** Subset of smartctl JSON output we care about */
interface SmartctlJson {
  smart_status?: { passed: boolean };
  temperature?: { current: number };
  power_on_time?: { hours: number };
  ata_smart_attributes?: {
    table: Array<{
      id: number;
      name: string;
      value: number;
      worst: number;
      thresh: number;
      raw: { string: string; value: number };
      type: { string: string };
      updated: { string: string };
      when_failed: { string: string };
    }>;
  };
  ata_smart_self_test_log?: {
    standard?: {
      table?: Array<{ status: { string: string } }>;
    };
  };
}

function mapSmartctlJson(device: string, json: SmartctlJson): SMARTData {
  const healthy = json.smart_status?.passed ?? false;

  const attributes: SMARTAttribute[] = (json.ata_smart_attributes?.table ?? []).map((attr) => ({
    id: attr.id,
    name: attr.name,
    value: attr.value,
    worst: attr.worst,
    threshold: attr.thresh,
    rawValue: attr.raw?.string ?? String(attr.raw?.value ?? ''),
    type: attr.type?.string ?? '',
    updated: attr.updated?.string ?? '',
    whenFailed: attr.when_failed?.string ?? '-',
  }));

  // Find reallocated sector count (SMART ID 5)
  const reallocAttr = attributes.find((a) => a.id === 5);

  // Last self-test status
  const selfTests = json.ata_smart_self_test_log?.standard?.table ?? [];
  const lastTest = selfTests[0];

  return {
    device,
    healthy,
    temperature: json.temperature?.current,
    powerOnHours: json.power_on_time?.hours,
    reallocatedSectors: reallocAttr ? parseInt(reallocAttr.rawValue, 10) || 0 : undefined,
    attributes,
    selfTestStatus: lastTest?.status?.string,
    overallAssessment: healthy ? 'PASSED' : 'FAILED',
  };
}

function createUnknownSmartData(device: string): SMARTData {
  return {
    device,
    healthy: false,
    attributes: [],
    overallAssessment: 'UNKNOWN',
  };
}

// ---------------------------------------------------------------------------
// By-id path resolution
// ---------------------------------------------------------------------------

/**
 * Attempt to find the /dev/disk/by-id/ path for a given device.
 * Returns undefined if no by-id symlink can be resolved.
 */
export async function getByIdPath(deviceName: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFile('find', [
      '/dev/disk/by-id/',
      '-lname', `*${deviceName}`,
      '-not', '-name', '*-part*',
    ]);

    const paths = stdout.trim().split('\n').filter(Boolean);
    // Prefer wwn- or scsi- paths
    const preferred = paths.find((p) => p.includes('wwn-') || p.includes('scsi-'));
    return preferred ?? paths[0] ?? undefined;
  } catch {
    return undefined;
  }
}
