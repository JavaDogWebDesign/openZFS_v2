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
 * Get the set of device names actively used by imported ZFS pools.
 * Parses `zpool status` to find device paths, then resolves to sdX names.
 */
async function getActiveZfsDevices(): Promise<Set<string>> {
  const active = new Set<string>();

  try {
    const { stdout } = await execFile('/usr/sbin/zpool', ['status', '-LP']);
    // Lines contain /dev/sdX or /dev/disk/by-id/... paths for active vdevs
    for (const line of stdout.split('\n')) {
      const trimmed = line.trim();
      // Match lines that look like device entries in zpool status
      const devMatch = trimmed.match(/^\/dev\/(\S+)/);
      if (devMatch) {
        // Extract the base device name (e.g. "sdb" from "/dev/sdb1" or "/dev/sdb")
        const baseName = devMatch[1].replace(/[0-9]+$/, '');
        active.add(baseName);
      }
      // Also match entries that are just device names (e.g. "sdb1  ONLINE  0  0  0")
      const nameMatch = trimmed.match(/^(sd[a-z]+\d*|nvme\d+n\d+p?\d*)\s+\w+/);
      if (nameMatch) {
        const baseName = nameMatch[1].replace(/[0-9]+$/, '').replace(/p$/, '');
        active.add(baseName);
      }
    }
  } catch {
    // No pools imported, or zpool not available — nothing is in use
  }

  return active;
}

/**
 * List all block devices on the system.
 * Filters to whole disks (type === 'disk') by default.
 */
export async function listDisks(): Promise<Disk[]> {
  const [lsblkResult, fullLsblkResult, activeDevices] = await Promise.all([
    execFile('lsblk', [
      '--json',
      '--bytes',
      '--output', 'NAME,PATH,SIZE,TYPE,MODEL,SERIAL,VENDOR,TRAN,ROTA,WWN,FSTYPE,MOUNTPOINT,LABEL,UUID',
      '--nodeps',
    ]),
    execFile('lsblk', [
      '--json',
      '--bytes',
      '--output', 'NAME,PATH,SIZE,TYPE,MODEL,SERIAL,VENDOR,TRAN,ROTA,WWN,FSTYPE,MOUNTPOINT,LABEL,UUID',
    ]),
    getActiveZfsDevices(),
  ]);

  const parsed: LsblkOutput = JSON.parse(lsblkResult.stdout);
  const fullParsed: LsblkOutput = JSON.parse(fullLsblkResult.stdout);

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

    // A disk is "in use" only if it belongs to an actively imported pool,
    // or has a non-ZFS filesystem mounted (e.g. ext4 root disk).
    const isActiveZfs = activeDevices.has(dev.name);
    const hasMountedPartition = partitions.some((p) => p.mountpoint);
    const inUse = isActiveZfs || hasMountedPartition;

    // Determine which pool owns this disk (if any)
    const poolLabel = partitions.find((p) => p.fstype === 'zfs_member')?.label;

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
      pool: isActiveZfs ? poolLabel : undefined,
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
