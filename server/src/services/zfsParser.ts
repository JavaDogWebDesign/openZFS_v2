/**
 * Parsers for ZFS / ZPOOL command output.
 *
 * All parsers accept raw stdout strings and return strongly-typed objects
 * from @zfs-manager/shared.  Each parser can handle both the tab-separated
 * `-Hp` text format and (where applicable) the `-j` JSON format.
 */

import type {
  Pool,
  PoolDetail,
  PoolStatus,
  VdevNode,
  VdevType,
  ScanInfo,
  Dataset,
  DatasetType,
  Snapshot,
  IOStatEntry,
} from '@zfs-manager/shared';

// ---------------------------------------------------------------------------
// Pool list parser
// ---------------------------------------------------------------------------

/**
 * Parse `zpool list -Hp -o name,size,allocated,free,fragmentation,capacity,dedupratio,health,guid,altroot`
 */
export function parsePoolList(stdout: string): Pool[] {
  const lines = stdout.trim().split('\n').filter(Boolean);

  return lines.map((line) => {
    const fields = line.split('\t');
    const [name, size, allocated, free, fragmentation, capacity, dedupratio, health, guid, altroot] = fields;

    return {
      name,
      guid: guid ?? '',
      status: (health ?? 'UNKNOWN') as PoolStatus,
      size: parseInt(size ?? '0', 10),
      allocated: parseInt(allocated ?? '0', 10),
      free: parseInt(free ?? '0', 10),
      fragmentation: parseInt(fragmentation ?? '0', 10),
      capacity: parseInt(capacity ?? '0', 10),
      dedupratio: parseFloat(dedupratio ?? '1.00'),
      health: health ?? 'UNKNOWN',
      altroot: altroot && altroot !== '-' ? altroot : undefined,
    };
  });
}

// ---------------------------------------------------------------------------
// Pool status parser
// ---------------------------------------------------------------------------

/**
 * Parse `zpool status -v <pool>` into a PoolDetail structure.
 *
 * The status output is a multi-section text block. This parser extracts:
 *   - pool name, state, scan info, vdev tree, errors
 *
 * The config section uses indentation to express the vdev tree hierarchy:
 *   - Depth 0: pool root name (skipped; metadata already in header)
 *   - Depth 1: top-level vdevs (mirror-0, raidz1-0, logs, cache, spares, ...)
 *   - Depth 2+: children of those vdevs (individual disks, etc.)
 */
export function parsePoolStatus(stdout: string, basePool?: Pool): PoolDetail {
  const detail: PoolDetail = {
    name: basePool?.name ?? '',
    guid: basePool?.guid ?? '',
    status: basePool?.status ?? 'ONLINE',
    size: basePool?.size ?? 0,
    allocated: basePool?.allocated ?? 0,
    free: basePool?.free ?? 0,
    fragmentation: basePool?.fragmentation ?? 0,
    capacity: basePool?.capacity ?? 0,
    dedupratio: basePool?.dedupratio ?? 1,
    health: basePool?.health ?? 'ONLINE',
    properties: {},
    vdevs: [],
    scan: undefined,
    errors: undefined,
  };

  const lines = stdout.split('\n');
  let section = '';
  let scanText = '';

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Detect sections  -- note `zpool status` uses leading whitespace labels
    if (line.startsWith('  pool:')) {
      detail.name = line.replace('  pool:', '').trim();
      section = 'pool';
      continue;
    }
    if (line.startsWith(' state:')) {
      detail.status = line.replace(' state:', '').trim() as PoolStatus;
      detail.health = detail.status;
      section = 'state';
      continue;
    }
    if (line.startsWith('status:')) {
      section = 'status';
      continue;
    }
    if (line.startsWith('action:')) {
      section = 'action';
      continue;
    }
    if (line.startsWith('  scan:')) {
      scanText = line.replace('  scan:', '').trim();
      section = 'scan';
      continue;
    }
    if (line.startsWith('config:')) {
      // Finalize scan text before entering config section
      if (scanText) {
        detail.scan = parseScanLine(scanText);
        scanText = '';
      }
      section = 'config';
      continue;
    }
    if (line.startsWith('errors:')) {
      detail.errors = line.replace('errors:', '').trim();
      section = 'errors';
      continue;
    }

    // Accumulate multi-line scan output (continuation lines are indented)
    if (section === 'scan' && line.match(/^\s/) && line.trim()) {
      scanText += ' ' + line.trim();
      continue;
    }

    // Parse vdev tree lines inside config section
    if (section === 'config' && line.trim() && !line.includes('NAME') && !line.includes('----')) {
      // Collected below after loop exit — we batch all config lines
    }
  }

  // Finalize scan if config section was never reached (edge case)
  if (scanText && !detail.scan) {
    detail.scan = parseScanLine(scanText);
  }

  // -------------------------------------------------------------------------
  // Second pass: collect config lines and build the vdev tree
  // -------------------------------------------------------------------------

  const configLines: string[] = [];
  let inConfig = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.startsWith('config:')) {
      inConfig = true;
      continue;
    }
    if (inConfig) {
      // A new top-level section ends the config block
      if (line.match(/^\S/) && line.trim()) {
        break;
      }
      // Skip the header row and separator
      if (line.includes('NAME') || line.includes('----')) {
        continue;
      }
      if (line.trim()) {
        configLines.push(rawLine); // keep original whitespace for indent detection
      }
    }
  }

  if (configLines.length > 0) {
    detail.vdevs = buildVdevTree(configLines);
  }

  return detail;
}

// ---------------------------------------------------------------------------
// Special vdev category keywords
// ---------------------------------------------------------------------------

/** Names that represent vdev category headers (no STATUS columns) */
const VDEV_CATEGORIES = new Set(['logs', 'log', 'cache', 'spares', 'spare', 'special', 'dedup']);

// ---------------------------------------------------------------------------
// Indent-based vdev tree builder
// ---------------------------------------------------------------------------

/**
 * Measure the indentation level of a config line.
 *
 * `zpool status` uses a leading tab then spaces to indent. We normalize by
 * expanding tabs to a fixed width (8 spaces) and counting total leading
 * whitespace characters. The exact value doesn't matter as long as it is
 * consistent — we only compare relative depths.
 */
function measureIndent(raw: string): number {
  let count = 0;
  for (const ch of raw) {
    if (ch === '\t') {
      count += 8; // tab stop
    } else if (ch === ' ') {
      count += 1;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Build a VdevNode tree from the raw config lines of `zpool status`.
 *
 * The first config line is always the pool root — we skip it and return only
 * its children (the actual vdevs).
 */
function buildVdevTree(configLines: string[]): VdevNode[] {
  if (configLines.length === 0) return [];

  // Parse all lines with their indent levels
  const entries: { indent: number; node: VdevNode }[] = [];

  for (const raw of configLines) {
    const indent = measureIndent(raw);
    const node = parseVdevLine(raw);
    if (node) {
      entries.push({ indent, node });
    }
  }

  if (entries.length === 0) return [];

  // The first entry is the pool root — skip it
  const childEntries = entries.slice(1);

  if (childEntries.length === 0) return [];

  // Use a stack to track the current parent chain: { indent, node }
  // The result array holds only the top-level vdevs (depth 1 relative to pool root).
  const result: VdevNode[] = [];
  const stack: { indent: number; node: VdevNode }[] = [];

  for (const entry of childEntries) {
    // Pop any stack entries that are not a parent of this entry
    while (stack.length > 0 && stack[stack.length - 1].indent >= entry.indent) {
      stack.pop();
    }

    if (stack.length === 0) {
      // This is a top-level vdev (direct child of the pool root)
      result.push(entry.node);
    } else {
      // This is a child of the current stack top
      const parent = stack[stack.length - 1].node;
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(entry.node);
    }

    stack.push(entry);
  }

  return result;
}

/**
 * Parse scan summary text (may span multiple lines joined into one string).
 *
 * Example texts (after joining continuation lines):
 *   "scrub repaired 0B in 00:12:34 with 0 errors on Sun Feb  1 00:24:01 2026"
 *   "scrub in progress since Mon Feb  2 10:00:00 2026 1.23T scanned at 123M/s, 1.23T issued at 100M/s, 2.00T total 61.5% done, 00:08:12 to go"
 *   "resilver in progress since ... 512M scanned at 256M/s, 512M issued at 200M/s"
 *   "scrub canceled on Tue Feb  3 12:00:00 2026"
 *   "none requested"
 */
function parseScanLine(text: string): ScanInfo {
  const info: ScanInfo = {
    function: 'none',
    state: 'none',
  };

  // Determine the scan function
  if (text.includes('scrub')) {
    info.function = 'scrub';
  } else if (text.includes('resilver')) {
    info.function = 'resilver';
  } else if (text.includes('trim')) {
    info.function = 'trim';
  }

  // Determine the state
  if (text.includes('in progress') || text.includes('scanning')) {
    info.state = 'scanning';
  } else if (text.includes('repaired') || text.includes('completed') || text.includes('finished')) {
    info.state = 'finished';
  } else if (text.includes('canceled')) {
    info.state = 'canceled';
  }

  // Extract percentage (e.g., "61.5% done")
  const pctMatch = text.match(/([\d.]+)%\s*done/);
  if (pctMatch) {
    info.percentage = parseFloat(pctMatch[1]);
  } else {
    // Fallback: bare percentage anywhere
    const barePct = text.match(/([\d.]+)%/);
    if (barePct) {
      info.percentage = parseFloat(barePct[1]);
    }
  }

  // Extract error count from "with N errors"
  const errMatch = text.match(/with\s+(\d+)\s+errors/);
  if (errMatch) {
    info.errors = parseInt(errMatch[1], 10);
  }

  // Extract start time from "since <date>"
  const sinceMatch = text.match(/since\s+(.+?)(?:\s+\d+\.\d+[TGMKB]|\s*$)/);
  if (sinceMatch) {
    info.startTime = sinceMatch[1].trim();
  }

  // Extract end time from "on <date>" (for completed scans: "... with 0 errors on Sun Feb 1 ...")
  const onDateMatch = text.match(/errors\s+on\s+(.+?)$/);
  if (onDateMatch) {
    info.endTime = onDateMatch[1].trim();
  }

  // Extract bytes scanned / issued / total
  // e.g., "1.23T scanned", "1.23T issued", "2.00T total"
  const totalMatch = text.match(/([\d.]+[TGMKB][iB]?)\s+total/i);
  if (totalMatch) {
    info.bytesTotal = parseHumanBytes(totalMatch[1]);
  }

  const issuedMatch = text.match(/([\d.]+[TGMKB][iB]?)\s+issued/i);
  if (issuedMatch) {
    info.bytesIssued = parseHumanBytes(issuedMatch[1]);
  }

  return info;
}

/**
 * Parse a human-readable byte string like "1.23T", "512M", "0B" into bytes.
 * This is a best-effort parser for ZFS scan output.
 */
function parseHumanBytes(str: string): number {
  const match = str.match(/^([\d.]+)\s*([TGMKB])/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  switch (unit) {
    case 'T': return Math.round(value * 1024 ** 4);
    case 'G': return Math.round(value * 1024 ** 3);
    case 'M': return Math.round(value * 1024 ** 2);
    case 'K': return Math.round(value * 1024);
    case 'B': return Math.round(value);
    default:  return 0;
  }
}

/**
 * Parse a single vdev line from `zpool status` config section.
 *
 * Handles both normal lines with STATE/READ/WRITE/CKSUM columns and special
 * category headers like `logs`, `cache`, `spares` that may appear without
 * any status columns.
 */
function parseVdevLine(line: string): VdevNode | null {
  // Lines look like:
  //   NAME                   STATE     READ WRITE CKSUM
  //   pool-name              ONLINE       0     0     0
  //     mirror-0             ONLINE       0     0     0
  //       sda                ONLINE       0     0     0
  //   logs                                              <-- category header (no STATE)
  const trimmed = line.replace(/^[\t ]+/, '');
  const parts = trimmed.split(/\s+/).filter(Boolean);

  if (parts.length < 1) {
    return null;
  }

  const name = parts[0];

  // Determine vdev type from name
  let type: VdevType = 'disk';
  if (name.startsWith('mirror')) type = 'mirror';
  else if (name.startsWith('raidz1')) type = 'raidz1';
  else if (name.startsWith('raidz2')) type = 'raidz2';
  else if (name.startsWith('raidz3')) type = 'raidz3';
  else if (name.startsWith('draid')) type = 'draid';
  else if (name === 'logs' || name === 'log') type = 'log';
  else if (name === 'cache') type = 'cache';
  else if (name === 'spares' || name === 'spare') type = 'spare';
  else if (name === 'special') type = 'special';
  else if (name === 'dedup') type = 'dedup';

  // Category headers (logs, cache, spares, etc.) may have only the name
  if (parts.length < 2 && VDEV_CATEGORIES.has(name)) {
    return {
      name,
      type,
      status: 'ONLINE' as PoolStatus,
      read_errors: 0,
      write_errors: 0,
      checksum_errors: 0,
      children: [],
    };
  }

  // Need at least name + status for a regular vdev line
  if (parts.length < 2) {
    return null;
  }

  const [, status, readErr, writeErr, cksumErr] = parts;

  return {
    name,
    type,
    status: (status ?? 'UNKNOWN') as PoolStatus,
    read_errors: parseInt(readErr ?? '0', 10) || 0,
    write_errors: parseInt(writeErr ?? '0', 10) || 0,
    checksum_errors: parseInt(cksumErr ?? '0', 10) || 0,
    children: [],
  };
}

// ---------------------------------------------------------------------------
// Dataset list parser
// ---------------------------------------------------------------------------

/**
 * Parse `zfs list -Hp -o name,type,mountpoint,used,available,referenced,compressratio,compression,quota,reservation,recordsize,atime,encryption,keystatus -t filesystem,volume`
 */
export function parseDatasetList(stdout: string): Dataset[] {
  const lines = stdout.trim().split('\n').filter(Boolean);

  return lines.map((line) => {
    const fields = line.split('\t');
    const [
      name, type, mountpoint, used, available, referenced,
      compressratio, compression, quota, reservation, recordsize,
      atime, encryption, keystatus,
    ] = fields;

    // Derive pool name from the first component of the dataset path
    const pool = name.split('/')[0];

    return {
      name,
      type: (type ?? 'filesystem') as DatasetType,
      pool,
      mountpoint: mountpoint && mountpoint !== 'none' && mountpoint !== '-' ? mountpoint : undefined,
      used: parseInt(used ?? '0', 10),
      available: parseInt(available ?? '0', 10),
      referenced: parseInt(referenced ?? '0', 10),
      compressratio: parseFloat(compressratio ?? '1.00'),
      compression: compression ?? 'off',
      quota: parseInt(quota ?? '0', 10),
      reservation: parseInt(reservation ?? '0', 10),
      recordsize: parseInt(recordsize ?? '131072', 10),
      atime: atime ?? 'on',
      encryption: encryption && encryption !== '-' ? encryption : undefined,
      keystatus: keystatus && keystatus !== '-' ? keystatus : undefined,
    };
  });
}

// ---------------------------------------------------------------------------
// Snapshot list parser
// ---------------------------------------------------------------------------

/**
 * Parse `zfs list -Hp -o name,used,referenced,creation,clones -t snapshot`
 */
export function parseSnapshotList(stdout: string): Snapshot[] {
  const lines = stdout.trim().split('\n').filter(Boolean);

  return lines.map((line) => {
    const fields = line.split('\t');
    const [name, used, referenced, creation, clones] = fields;

    // name is like "pool/dataset@snapname"
    const atIdx = name.indexOf('@');
    const dataset = atIdx >= 0 ? name.substring(0, atIdx) : name;
    const shortName = atIdx >= 0 ? name.substring(atIdx + 1) : name;

    return {
      name,
      dataset,
      shortName,
      creation: creation ?? new Date().toISOString(),
      used: parseInt(used ?? '0', 10),
      referenced: parseInt(referenced ?? '0', 10),
      clones: clones && clones !== '-' ? clones.split(',').filter(Boolean) : [],
    };
  });
}

// ---------------------------------------------------------------------------
// IOStat parser
// ---------------------------------------------------------------------------

/**
 * Parse `zpool iostat -Hp` output.
 *
 * Each line: pool  capacity_alloc  capacity_free  ops_read  ops_write  bw_read  bw_write
 */
export function parseZpoolIostat(stdout: string): IOStatEntry[] {
  const lines = stdout.trim().split('\n').filter(Boolean);
  const now = Date.now();

  return lines.map((line) => {
    const fields = line.split('\t');
    const [pool, , , readOps, writeOps, readBw, writeBw] = fields;

    return {
      pool: pool ?? '',
      timestamp: now,
      readOps: parseInt(readOps ?? '0', 10),
      writeOps: parseInt(writeOps ?? '0', 10),
      readBandwidth: parseInt(readBw ?? '0', 10),
      writeBandwidth: parseInt(writeBw ?? '0', 10),
    };
  });
}

// ---------------------------------------------------------------------------
// JSON output helpers
// ---------------------------------------------------------------------------

/**
 * Parse JSON output from `zpool list -j` (OpenZFS 2.2+).
 * The shape varies by version; this is a best-effort parser.
 */
export function parsePoolListJson(json: unknown): Pool[] {
  // OpenZFS JSON output wraps pools in a top-level object
  const data = json as Record<string, unknown>;
  const pools: Pool[] = [];

  // Attempt common JSON shapes
  const poolsObj = (data.pools ?? data.output ?? {}) as Record<string, Record<string, unknown>>;

  for (const [name, props] of Object.entries(poolsObj)) {
    pools.push({
      name,
      guid: String(props.guid ?? ''),
      status: (String(props.health ?? props.state ?? 'UNKNOWN')) as PoolStatus,
      size: Number(props.size ?? 0),
      allocated: Number(props.allocated ?? props.alloc ?? 0),
      free: Number(props.free ?? 0),
      fragmentation: Number(props.fragmentation ?? props.frag ?? 0),
      capacity: Number(props.capacity ?? props.cap ?? 0),
      dedupratio: Number(props.dedupratio ?? props.dedup ?? 1),
      health: String(props.health ?? props.state ?? 'UNKNOWN'),
    });
  }

  return pools;
}
