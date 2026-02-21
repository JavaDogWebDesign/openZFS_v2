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

const SMB_CONF = '/etc/samba/smb.conf';

/** Directory for individual SMB share include files */
const SMB_SHARES_DIR = '/etc/samba/smb.conf.d';

/** Directory for individual NFS export files */
const NFS_EXPORTS_DIR = '/etc/exports.d';

/** Prefix for managed SMB share files */
const SMB_FILE_PREFIX = 'zfs-manager-';

/** Prefix for managed NFS export files */
const NFS_FILE_PREFIX = 'zfs-manager-';

/** Built-in / meta sections to skip when listing shares */
const SKIP_SECTIONS = new Set(['global', 'homes', 'printers', 'print$', 'IPC$']);

// ============================================================================
// SMB Share Management
// ============================================================================

/**
 * List ALL SMB shares by parsing the main smb.conf and any managed
 * include files. This shows everything Samba is actually serving.
 */
export async function listSmbShares(): Promise<SMBShare[]> {
  const shares: SMBShare[] = [];
  const seen = new Set<string>();

  // 1) Parse the main smb.conf for share sections
  try {
    const conf = await fs.readFile(SMB_CONF, 'utf-8');
    const parsed = parseSmbConfSections(conf);
    console.log(`[shares] Parsed ${parsed.length} share(s) from smb.conf`);
    for (const share of parsed) {
      if (!seen.has(share.name)) {
        seen.add(share.name);
        shares.push(share);
      }
    }
  } catch (err) {
    console.error('[shares] Failed to read smb.conf:', err);
  }

  // 2) Parse managed include files in smb.conf.d/
  try {
    await fs.mkdir(SMB_SHARES_DIR, { recursive: true });
    const files = await fs.readdir(SMB_SHARES_DIR);
    for (const file of files) {
      if (!file.endsWith('.conf')) continue;
      const filePath = path.join(SMB_SHARES_DIR, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = parseSmbConfSections(content);
      for (const share of parsed) {
        if (!seen.has(share.name)) {
          seen.add(share.name);
          shares.push(share);
        }
      }
    }
  } catch {
    // Directory may not exist
  }

  console.log(`[shares] Total SMB shares found: ${shares.length} [${shares.map((s) => s.name).join(', ')}]`);
  return shares;
}

/**
 * Split a Samba config file into sections and parse each share.
 * Skips [global], [homes], [printers], [print$], [IPC$].
 */
function parseSmbConfSections(content: string): SMBShare[] {
  const shares: SMBShare[] = [];

  // Split on section headers — each starts with [name]
  const sections = content.split(/(?=^\[)/m);

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    const nameMatch = trimmed.match(/^\[([^\]]+)\]/);
    if (!nameMatch) continue;

    const name = nameMatch[1];
    if (SKIP_SECTIONS.has(name)) continue;

    const share = parseSmbShareConfig(trimmed);
    if (share) {
      shares.push(share);
    }
  }

  return shares;
}

/**
 * Create a new SMB share.
 */
export async function createSmbShare(share: SMBShare): Promise<SMBShare> {
  // Check if this share name already exists anywhere
  const allShares = await listSmbShares();
  if (allShares.some((s) => s.name === share.name)) {
    throw new AppError(409, 'SHARE_EXISTS', `SMB share "${share.name}" already exists`);
  }

  // Ensure the share path directory exists
  try {
    await fs.mkdir(share.path, { recursive: true });
    console.log(`[shares] Ensured share path exists: ${share.path}`);
  } catch (err) {
    console.error(`[shares] Failed to create share path ${share.path}:`, err);
    throw new AppError(500, 'PATH_CREATE_FAILED', `Failed to create share path: ${share.path}`);
  }

  const config = generateSmbShareConfig(share);
  const filePath = path.join(SMB_SHARES_DIR, `${SMB_FILE_PREFIX}${share.name}.conf`);

  await fs.mkdir(SMB_SHARES_DIR, { recursive: true });
  await fs.writeFile(filePath, config, 'utf-8');
  console.log(`[shares] Wrote SMB config: ${filePath}`);

  await ensureSmbInclude();
  await restartSmb();

  return share;
}

/**
 * Update an existing SMB share.
 */
export async function updateSmbShare(name: string, updates: Partial<SMBShare>): Promise<SMBShare> {
  const existing = await findSmbShareAnywhere(name);
  if (!existing) {
    throw new AppError(404, 'SHARE_NOT_FOUND', `SMB share "${name}" not found`);
  }

  const updated: SMBShare = { ...existing, ...updates, name }; // name cannot change
  const config = generateSmbShareConfig(updated);

  // If it existed in smb.conf, remove it from there and write to managed dir instead
  await removeSectionFromSmbConf(name);

  const filePath = path.join(SMB_SHARES_DIR, `${SMB_FILE_PREFIX}${name}.conf`);
  await fs.mkdir(SMB_SHARES_DIR, { recursive: true });
  await fs.writeFile(filePath, config, 'utf-8');
  console.log(`[shares] Updated SMB config: ${filePath}`);

  await ensureSmbInclude();
  await restartSmb();

  return updated;
}

/**
 * Delete an SMB share.
 *
 * Removes from managed config files and/or the main smb.conf.
 */
export async function deleteSmbShare(name: string): Promise<void> {
  let deleted = false;

  // Try removing the managed config file
  const managedPath = path.join(SMB_SHARES_DIR, `${SMB_FILE_PREFIX}${name}.conf`);
  try {
    await fs.unlink(managedPath);
    console.log(`[shares] Deleted managed config: ${managedPath}`);
    deleted = true;
  } catch {
    // Not a managed share
  }

  // Also remove from main smb.conf if present
  if (await removeSectionFromSmbConf(name)) {
    deleted = true;
  }

  if (!deleted) {
    throw new AppError(404, 'SHARE_NOT_FOUND', `SMB share "${name}" not found`);
  }

  await restartSmb();
}

/**
 * Find a share by name across all sources (smb.conf + managed files).
 */
async function findSmbShareAnywhere(name: string): Promise<SMBShare | null> {
  const allShares = await listSmbShares();
  return allShares.find((s) => s.name === name) ?? null;
}

/**
 * Remove a [sharename] section from the main smb.conf.
 * Returns true if the section was found and removed.
 */
async function removeSectionFromSmbConf(name: string): Promise<boolean> {
  try {
    const conf = await fs.readFile(SMB_CONF, 'utf-8');

    // Match [sharename] section up to the next section header or EOF
    const sectionRegex = new RegExp(
      `\\n?\\[${escapeRegex(name)}\\]\\n[\\s\\S]*?(?=\\n\\[|$)`,
    );

    if (sectionRegex.test(conf)) {
      const newConf = conf.replace(sectionRegex, '').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
      await fs.writeFile(SMB_CONF, newConf, 'utf-8');
      console.log(`[shares] Removed [${name}] section from smb.conf`);
      return true;
    }
  } catch (err) {
    console.error('[shares] Error reading/modifying smb.conf:', err);
  }
  return false;
}

/** Escape special regex characters in a string */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  const nameMatch = content.match(/^\[([^\]]+)\]/m);
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
 * Ensure the main smb.conf includes our share config directory.
 * The include line is placed right after the [global] section so it
 * doesn't accidentally end up inside a share section.
 */
async function ensureSmbInclude(): Promise<void> {
  const includeGlob = `include = ${SMB_SHARES_DIR}/*.conf`;

  try {
    let conf = await fs.readFile(SMB_CONF, 'utf-8');

    // Already set up?
    if (conf.includes(SMB_SHARES_DIR)) {
      console.log('[shares] smb.conf already includes our share directory');
      return;
    }

    // Find the end of the [global] section (= start of the next [...] section)
    // and insert the include line right before it.
    const globalEnd = conf.search(/\n\[(?!global\])/i);
    if (globalEnd !== -1) {
      const before = conf.slice(0, globalEnd);
      const after = conf.slice(globalEnd);
      conf = before + '\n\n# ZFS Manager managed shares\n' + includeGlob + '\n' + after;
    } else {
      // No other sections — just append
      conf = conf.trimEnd() + '\n\n# ZFS Manager managed shares\n' + includeGlob + '\n';
    }

    await fs.writeFile(SMB_CONF, conf, 'utf-8');
    console.log(`[shares] Added include directive to smb.conf (inside [global]): ${includeGlob}`);
  } catch (err) {
    console.error('[shares] Failed to update smb.conf with include directive:', err);
    throw new AppError(500, 'SMB_CONFIG_ERROR', 'Failed to update Samba configuration to include managed shares');
  }
}

/**
 * Restart the Samba services to apply configuration changes.
 */
async function restartSmb(): Promise<void> {
  // Validate config before restarting
  try {
    const { stderr } = await execFile('testparm', ['-s'], { timeout: 10_000 });
    console.log('[shares] testparm validation passed');
    if (stderr) console.log('[shares] testparm warnings:', stderr.slice(0, 500));
  } catch (err) {
    const error = err as Error & { stderr?: string };
    console.error('[shares] testparm validation FAILED:', error.stderr ?? error.message);
    // Don't throw — testparm exits non-zero for warnings too, and we still want to try restarting
  }

  // Restart smbd (Debian/Ubuntu use smbd, RHEL/CentOS use smb)
  try {
    await execFile('systemctl', ['restart', 'smbd']);
    console.log('[shares] smbd restarted successfully');
  } catch {
    try {
      await execFile('systemctl', ['restart', 'smb']);
      console.log('[shares] smb restarted successfully');
    } catch (err) {
      const error = err as Error & { stderr?: string };
      console.error('[shares] Failed to restart Samba:', error.stderr ?? error.message);
      throw new AppError(500, 'SMB_RESTART_FAILED', 'Failed to restart Samba service');
    }
  }
}

/**
 * Re-export NFS shares to apply configuration changes.
 */
async function reexportNfs(): Promise<void> {
  try {
    await execFile('exportfs', ['-ra']);
    console.log('[shares] NFS exports reloaded successfully');
  } catch (err) {
    const error = err as Error & { stderr?: string };
    console.error('[shares] Failed to re-export NFS shares:', error.stderr ?? error.message);
  }
}
