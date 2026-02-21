/**
 * File sharing service for SMB (Samba) and NFS exports.
 *
 * SMB shares are managed via include files in /etc/samba/smb.conf.d/
 * or by editing the main smb.conf. NFS exports are managed via
 * individual files in /etc/exports.d/.
 *
 * After any change, the relevant service is restarted to apply
 * the new configuration.
 *
 * All file system commands use execFile to prevent shell injection.
 */

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { SMBShare, NFSShare, NFSAccessRule } from '@zfs-manager/shared';
import { AppError } from '../middleware/errorHandler.js';

const execFile = promisify(execFileCb);

// ---------------------------------------------------------------------------
// Configuration paths
// ---------------------------------------------------------------------------

/** Directory for individual SMB share include files */
const SMB_SHARES_DIR = '/etc/samba/smb.conf.d';

/** Directory for individual NFS export files */
const NFS_EXPORTS_DIR = '/etc/exports.d';

/** Prefix for managed SMB share files */
const SMB_FILE_PREFIX = 'zfs-manager-';

/** Prefix for managed NFS export files */
const NFS_FILE_PREFIX = 'zfs-manager-';

// ============================================================================
// SMB Share Management
// ============================================================================

/**
 * List all managed SMB shares by parsing include files.
 */
export async function listSmbShares(): Promise<SMBShare[]> {
  try {
    await fs.mkdir(SMB_SHARES_DIR, { recursive: true });
  } catch {
    // Directory may already exist or we may not have permissions
  }

  const shares: SMBShare[] = [];

  try {
    const files = await fs.readdir(SMB_SHARES_DIR);

    for (const file of files) {
      if (!file.startsWith(SMB_FILE_PREFIX) || !file.endsWith('.conf')) continue;

      const filePath = path.join(SMB_SHARES_DIR, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const share = parseSmbShareConfig(content);
      if (share) {
        shares.push(share);
      }
    }
  } catch {
    // If we can't read the directory, return empty list
  }

  return shares;
}

/**
 * Create a new SMB share.
 */
export async function createSmbShare(share: SMBShare): Promise<SMBShare> {
  const existing = await getSmbShare(share.name);
  if (existing) {
    throw new AppError(409, 'SHARE_EXISTS', `SMB share "${share.name}" already exists`);
  }

  const config = generateSmbShareConfig(share);
  const filePath = path.join(SMB_SHARES_DIR, `${SMB_FILE_PREFIX}${share.name}.conf`);

  await fs.mkdir(SMB_SHARES_DIR, { recursive: true });
  await fs.writeFile(filePath, config, 'utf-8');
  await restartSmb();

  return share;
}

/**
 * Update an existing SMB share.
 */
export async function updateSmbShare(name: string, updates: Partial<SMBShare>): Promise<SMBShare> {
  const existing = await getSmbShare(name);
  if (!existing) {
    throw new AppError(404, 'SHARE_NOT_FOUND', `SMB share "${name}" not found`);
  }

  const updated: SMBShare = { ...existing, ...updates, name }; // name cannot change
  const config = generateSmbShareConfig(updated);
  const filePath = path.join(SMB_SHARES_DIR, `${SMB_FILE_PREFIX}${name}.conf`);

  await fs.writeFile(filePath, config, 'utf-8');
  await restartSmb();

  return updated;
}

/**
 * Delete an SMB share.
 */
export async function deleteSmbShare(name: string): Promise<void> {
  const filePath = path.join(SMB_SHARES_DIR, `${SMB_FILE_PREFIX}${name}.conf`);

  try {
    await fs.unlink(filePath);
  } catch {
    throw new AppError(404, 'SHARE_NOT_FOUND', `SMB share "${name}" not found`);
  }

  await restartSmb();
}

/**
 * Get a single SMB share by name.
 */
async function getSmbShare(name: string): Promise<SMBShare | null> {
  const filePath = path.join(SMB_SHARES_DIR, `${SMB_FILE_PREFIX}${name}.conf`);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return parseSmbShareConfig(content);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// SMB config generation / parsing
// ---------------------------------------------------------------------------

/**
 * Generate a Samba share configuration block.
 */
function generateSmbShareConfig(share: SMBShare): string {
  const lines: string[] = [
    `[${share.name}]`,
    `   path = ${share.path}`,
    `   browseable = ${share.browseable ? 'yes' : 'no'}`,
    `   read only = ${share.readonly ? 'yes' : 'no'}`,
    `   guest ok = ${share.guestOk ? 'yes' : 'no'}`,
  ];

  if (share.comment) {
    lines.splice(1, 0, `   comment = ${share.comment}`);
  }
  if (share.validUsers && share.validUsers.length > 0) {
    lines.push(`   valid users = ${share.validUsers.join(' ')}`);
  }
  if (share.invalidUsers && share.invalidUsers.length > 0) {
    lines.push(`   invalid users = ${share.invalidUsers.join(' ')}`);
  }
  if (share.writeList && share.writeList.length > 0) {
    lines.push(`   write list = ${share.writeList.join(' ')}`);
  }
  if (share.createMask) {
    lines.push(`   create mask = ${share.createMask}`);
  }
  if (share.directoryMask) {
    lines.push(`   directory mask = ${share.directoryMask}`);
  }
  if (share.forceUser) {
    lines.push(`   force user = ${share.forceUser}`);
  }
  if (share.forceGroup) {
    lines.push(`   force group = ${share.forceGroup}`);
  }
  if (share.vfsObjects && share.vfsObjects.length > 0) {
    lines.push(`   vfs objects = ${share.vfsObjects.join(' ')}`);
  }
  if (share.recycleRepository) {
    lines.push(`   recycle:repository = ${share.recycleRepository}`);
  }

  return lines.join('\n') + '\n';
}

/**
 * Parse a Samba share configuration block back into an SMBShare object.
 */
function parseSmbShareConfig(content: string): SMBShare | null {
  const nameMatch = content.match(/^\[(.+)\]/m);
  if (!nameMatch) return null;

  const name = nameMatch[1];

  const get = (key: string): string | undefined => {
    const re = new RegExp(`^\\s*${key}\\s*=\\s*(.+)$`, 'mi');
    const match = content.match(re);
    return match?.[1]?.trim();
  };

  const getBool = (key: string, defaultVal: boolean): boolean => {
    const val = get(key)?.toLowerCase();
    if (val === 'yes' || val === 'true') return true;
    if (val === 'no' || val === 'false') return false;
    return defaultVal;
  };

  const getList = (key: string): string[] | undefined => {
    const val = get(key);
    return val ? val.split(/\s+/).filter(Boolean) : undefined;
  };

  return {
    name,
    path: get('path') ?? '',
    comment: get('comment'),
    browseable: getBool('browseable', true),
    readonly: getBool('read only', false),
    guestOk: getBool('guest ok', false),
    validUsers: getList('valid users'),
    invalidUsers: getList('invalid users'),
    writeList: getList('write list'),
    createMask: get('create mask'),
    directoryMask: get('directory mask'),
    forceUser: get('force user'),
    forceGroup: get('force group'),
    vfsObjects: getList('vfs objects'),
    recycleRepository: get('recycle:repository'),
    enabled: true,
  };
}

// ============================================================================
// NFS Export Management
// ============================================================================

/**
 * List all managed NFS exports.
 */
export async function listNfsExports(): Promise<NFSShare[]> {
  try {
    await fs.mkdir(NFS_EXPORTS_DIR, { recursive: true });
  } catch {
    // ignore
  }

  const exports: NFSShare[] = [];

  try {
    const files = await fs.readdir(NFS_EXPORTS_DIR);

    for (const file of files) {
      if (!file.startsWith(NFS_FILE_PREFIX) || !file.endsWith('.exports')) continue;

      const filePath = path.join(NFS_EXPORTS_DIR, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const nfsShare = parseNfsExport(content);
      if (nfsShare) {
        exports.push(nfsShare);
      }
    }
  } catch {
    // If we can't read the directory, return empty list
  }

  return exports;
}

/**
 * Create a new NFS export.
 */
export async function createNfsExport(nfsShare: NFSShare): Promise<NFSShare> {
  const safeName = nfsShare.path.replace(/\//g, '_').replace(/^_/, '');
  const filePath = path.join(NFS_EXPORTS_DIR, `${NFS_FILE_PREFIX}${safeName}.exports`);

  const config = generateNfsExport(nfsShare);

  await fs.mkdir(NFS_EXPORTS_DIR, { recursive: true });
  await fs.writeFile(filePath, config, 'utf-8');
  await reexportNfs();

  return nfsShare;
}

/**
 * Update an existing NFS export.
 */
export async function updateNfsExport(exportPath: string, updates: Partial<NFSShare>): Promise<NFSShare> {
  const existing = await findNfsExport(exportPath);
  if (!existing) {
    throw new AppError(404, 'EXPORT_NOT_FOUND', `NFS export for "${exportPath}" not found`);
  }

  const updated: NFSShare = { ...existing, ...updates, path: exportPath };
  const safeName = exportPath.replace(/\//g, '_').replace(/^_/, '');
  const filePath = path.join(NFS_EXPORTS_DIR, `${NFS_FILE_PREFIX}${safeName}.exports`);

  const config = generateNfsExport(updated);
  await fs.writeFile(filePath, config, 'utf-8');
  await reexportNfs();

  return updated;
}

/**
 * Delete an NFS export.
 */
export async function deleteNfsExport(exportPath: string): Promise<void> {
  const safeName = exportPath.replace(/\//g, '_').replace(/^_/, '');
  const filePath = path.join(NFS_EXPORTS_DIR, `${NFS_FILE_PREFIX}${safeName}.exports`);

  try {
    await fs.unlink(filePath);
  } catch {
    throw new AppError(404, 'EXPORT_NOT_FOUND', `NFS export for "${exportPath}" not found`);
  }

  await reexportNfs();
}

/**
 * Find a specific NFS export by path.
 */
async function findNfsExport(exportPath: string): Promise<NFSShare | null> {
  const allExports = await listNfsExports();
  return allExports.find((e) => e.path === exportPath) ?? null;
}

// ---------------------------------------------------------------------------
// NFS config generation / parsing
// ---------------------------------------------------------------------------

/**
 * Generate an /etc/exports.d/ entry.
 * Format: /path/to/share  host1(opts) host2(opts) ...
 */
function generateNfsExport(nfsShare: NFSShare): string {
  const lines: string[] = [];

  if (nfsShare.comment) {
    lines.push(`# ${nfsShare.comment}`);
  }

  const accessParts = nfsShare.rules.map((rule: NFSAccessRule) => {
    const opts = rule.options.join(',');
    return `${rule.host}(${opts})`;
  });

  lines.push(`${nfsShare.path}  ${accessParts.join(' ')}`);

  return lines.join('\n') + '\n';
}

/**
 * Parse an NFS export file back into an NFSShare object.
 */
function parseNfsExport(content: string): NFSShare | null {
  const lines = content.trim().split('\n');
  let comment: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('#')) {
      comment = trimmed.slice(1).trim();
      continue;
    }

    if (!trimmed) continue;

    // Parse: /path host1(opts) host2(opts)
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) continue;

    const exportPath = parts[0];
    const rules: NFSAccessRule[] = [];

    for (let i = 1; i < parts.length; i++) {
      const match = parts[i].match(/^(.+?)\((.+)\)$/);
      if (match) {
        rules.push({
          host: match[1],
          options: match[2].split(',').filter(Boolean),
        });
      }
    }

    return {
      path: exportPath,
      enabled: true,
      rules,
      comment,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Service management
// ---------------------------------------------------------------------------

/**
 * Restart the Samba services to apply configuration changes.
 */
async function restartSmb(): Promise<void> {
  try {
    await execFile('systemctl', ['restart', 'smbd']);
  } catch {
    // Try nmbd as well, but don't fail if it's not running
    try {
      await execFile('systemctl', ['restart', 'smb']);
    } catch {
      console.warn('[shares] Failed to restart Samba service');
    }
  }
}

/**
 * Re-export NFS shares to apply configuration changes.
 */
async function reexportNfs(): Promise<void> {
  try {
    await execFile('exportfs', ['-ra']);
  } catch {
    console.warn('[shares] Failed to re-export NFS shares');
  }
}
