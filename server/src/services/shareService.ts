/**
 * File sharing service for SMB (Samba) and NFS exports.
 *
 * Managed SMB shares are stored in a single file:
 *   /etc/samba/zfs-manager-shares.conf
 * which is included from the main smb.conf.
 *
 * The listing also reads shares defined directly in smb.conf
 * so the UI shows everything Samba is actually serving.
 *
 * NFS exports are managed via individual files in /etc/exports.d/.
 *
 * After any change, the relevant service is restarted to apply
 * the new configuration.
 *
 * All file system commands use execFile to prevent shell injection.
 */

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import type { SMBShare, NFSShare, NFSAccessRule } from '@zfs-manager/shared';
import { AppError } from '../middleware/errorHandler.js';

const execFile = promisify(execFileCb);

// ---------------------------------------------------------------------------
// Configuration paths
// ---------------------------------------------------------------------------

const SMB_CONF = '/etc/samba/smb.conf';

/** Single file where all managed shares live */
const MANAGED_SHARES_FILE = '/etc/samba/zfs-manager-shares.conf';

/** Directory for individual NFS export files */
const NFS_EXPORTS_DIR = '/etc/exports.d';

/** Prefix for managed NFS export files */
const NFS_FILE_PREFIX = 'zfs-manager-';

/** Built-in / meta sections to skip when listing shares */
const SKIP_SECTIONS = new Set(['global', 'homes', 'printers', 'print$', 'IPC$']);

// ============================================================================
// SMB Share Management
// ============================================================================

/**
 * List ALL SMB shares — both managed (from our include file)
 * and any defined directly in smb.conf.
 */
export async function listSmbShares(): Promise<SMBShare[]> {
  const shares: SMBShare[] = [];
  const seen = new Set<string>();

  // 1) Parse the main smb.conf for share sections defined inline
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

  // 2) Parse our managed shares file
  try {
    const content = await fs.readFile(MANAGED_SHARES_FILE, 'utf-8');
    const parsed = parseSmbConfSections(content);
    console.log(`[shares] Parsed ${parsed.length} managed share(s) from ${MANAGED_SHARES_FILE}`);
    for (const share of parsed) {
      if (!seen.has(share.name)) {
        seen.add(share.name);
        shares.push(share);
      }
    }
  } catch {
    // File may not exist yet — that's fine
  }

  console.log(`[shares] Total SMB shares: ${shares.length} [${shares.map((s) => s.name).join(', ')}]`);
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
 * Read all managed shares from our single config file.
 */
async function readManagedShares(): Promise<SMBShare[]> {
  try {
    const content = await fs.readFile(MANAGED_SHARES_FILE, 'utf-8');
    return parseSmbConfSections(content);
  } catch {
    return [];
  }
}

/**
 * Write all managed shares back to our single config file.
 */
async function writeManagedShares(shares: SMBShare[]): Promise<void> {
  const header = '# Managed by ZFS Manager — do not edit manually\n\n';
  const blocks = shares.map((s) => generateSmbShareConfig(s));
  await fs.writeFile(MANAGED_SHARES_FILE, header + blocks.join('\n'), 'utf-8');
  console.log(`[shares] Wrote ${shares.length} share(s) to ${MANAGED_SHARES_FILE}`);
}

/**
 * Create a new SMB share.
 */
export async function createSmbShare(share: SMBShare): Promise<SMBShare> {
  // Check all sources for name collision
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

  // Set filesystem permissions so valid users can actually write
  await setSharePermissions(share);

  // Add to our managed shares file
  const managed = await readManagedShares();
  managed.push(share);
  await writeManagedShares(managed);

  await ensureSmbInclude();
  await restartSmb();

  return share;
}

/**
 * Update an existing SMB share.
 */
export async function updateSmbShare(name: string, updates: Partial<SMBShare>): Promise<SMBShare> {
  const allShares = await listSmbShares();
  const existing = allShares.find((s) => s.name === name);
  if (!existing) {
    throw new AppError(404, 'SHARE_NOT_FOUND', `SMB share "${name}" not found`);
  }

  const updated: SMBShare = { ...existing, ...updates, name };

  // Update filesystem permissions for new user assignments
  await setSharePermissions(updated);

  // Remove from smb.conf if it was defined there (move to managed file)
  await removeSectionFromSmbConf(name);

  // Update in managed shares file
  let managed = await readManagedShares();
  managed = managed.filter((s) => s.name !== name);
  managed.push(updated);
  await writeManagedShares(managed);

  await ensureSmbInclude();
  await restartSmb();

  return updated;
}

/**
 * Delete an SMB share.
 */
export async function deleteSmbShare(name: string): Promise<void> {
  let deleted = false;

  // Remove from managed shares file
  const managed = await readManagedShares();
  const filtered = managed.filter((s) => s.name !== name);
  if (filtered.length < managed.length) {
    await writeManagedShares(filtered);
    console.log(`[shares] Removed "${name}" from managed shares`);
    deleted = true;
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

// ---------------------------------------------------------------------------
// Filesystem permissions
// ---------------------------------------------------------------------------

/**
 * Set filesystem permissions on a share directory so all assigned users
 * can actually read/write files.
 *
 * Uses POSIX ACLs (setfacl) to grant each user in validUsers and writeList
 * explicit rwx access, plus a default ACL so new files/dirs inherit the same.
 */
async function setSharePermissions(share: SMBShare): Promise<void> {
  try {
    // Ensure base permissions: setgid + rwxrwxr-x
    await execFile('chmod', ['2775', share.path]);
    console.log(`[shares] Set permissions 2775 on ${share.path}`);

    // Collect all users who need filesystem access
    const users = new Set<string>();
    if (share.validUsers) share.validUsers.forEach((u) => users.add(u));
    if (share.writeList) share.writeList.forEach((u) => users.add(u));
    if (share.forceUser) users.add(share.forceUser);

    if (users.size === 0) return;

    // Set ACLs for each user
    for (const user of users) {
      try {
        // Access ACL: user gets rwx on the directory itself
        await execFile('setfacl', ['-m', `u:${user}:rwx`, share.path]);
        // Default ACL: new files/subdirs inherit rwx for this user
        await execFile('setfacl', ['-d', '-m', `u:${user}:rwx`, share.path]);
        console.log(`[shares] Set ACL u:${user}:rwx on ${share.path}`);
      } catch (err) {
        console.error(`[shares] Failed to set ACL for ${user} on ${share.path}:`, err);
      }
    }

    // Also set ownership to the first user for compatibility
    const owner = share.forceUser || share.validUsers?.[0];
    const group = share.forceGroup || owner;
    if (owner) {
      const chownTarget = group ? `${owner}:${group}` : owner;
      await execFile('chown', [chownTarget, share.path]);
      console.log(`[shares] Set ownership ${chownTarget} on ${share.path}`);
    }
  } catch (err) {
    console.error(`[shares] Failed to set permissions on ${share.path}:`, err);
    // Non-fatal — share will still work, just may have permission issues
  }
}

// ---------------------------------------------------------------------------
// User-share assignment helpers
// ---------------------------------------------------------------------------

/**
 * Get which shares a user is assigned to (appears in validUsers or writeList).
 */
export async function getUserShareAssignments(username: string): Promise<string[]> {
  const allShares = await listSmbShares();
  return allShares
    .filter((s) =>
      s.validUsers?.includes(username) || s.writeList?.includes(username),
    )
    .map((s) => s.name);
}

/**
 * Assign a user to a set of shares.
 *
 * For each named share: adds the user to both validUsers and writeList
 * (if not already present) and updates filesystem ACLs.
 *
 * Shares NOT in the list will have the user removed.
 */
export async function assignUserToShares(username: string, shareNames: string[]): Promise<void> {
  const allShares = await listSmbShares();
  const wantedSet = new Set(shareNames);

  for (const share of allShares) {
    const isAssigned =
      share.validUsers?.includes(username) || share.writeList?.includes(username);
    const shouldBeAssigned = wantedSet.has(share.name);

    if (shouldBeAssigned && !isAssigned) {
      // Add user to this share
      const validUsers = [...(share.validUsers ?? []), username];
      const writeList = [...(share.writeList ?? []), username];
      await updateSmbShare(share.name, { validUsers, writeList });
      console.log(`[shares] Added ${username} to share "${share.name}"`);
    } else if (!shouldBeAssigned && isAssigned) {
      // Remove user from this share
      const validUsers = (share.validUsers ?? []).filter((u) => u !== username);
      const writeList = (share.writeList ?? []).filter((u) => u !== username);
      await updateSmbShare(share.name, { validUsers, writeList });
      console.log(`[shares] Removed ${username} from share "${share.name}"`);
    }
  }
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

      const filePath = NFS_EXPORTS_DIR + '/' + file;
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
  const filePath = NFS_EXPORTS_DIR + '/' + `${NFS_FILE_PREFIX}${safeName}.exports`;

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
  const filePath = NFS_EXPORTS_DIR + '/' + `${NFS_FILE_PREFIX}${safeName}.exports`;

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
  const filePath = NFS_EXPORTS_DIR + '/' + `${NFS_FILE_PREFIX}${safeName}.exports`;

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
 * Ensure smb.conf includes our managed shares file in the [global] section.
 *
 * Samba's `include` does NOT support globs (*.conf) — it needs an
 * exact file path. So we use a single file for all managed shares.
 *
 * This function:
 * 1. Strips ALL include lines (ours + stray ones from earlier versions)
 * 2. Re-inserts our include at the end of [global], before any share sections
 *
 * This ensures correct placement even if the user never touches the CLI.
 */
async function ensureSmbInclude(): Promise<void> {
  const includeLine = `include = ${MANAGED_SHARES_FILE}`;

  try {
    let conf = await fs.readFile(SMB_CONF, 'utf-8');

    // Strip ALL our include lines and stray ones — we'll re-add in the right place
    const stripPatterns = [
      /\n?[^\n#;]*include\s*=\s*\/etc\/samba\/zfs-manager-shares\.conf[^\n]*\n?/g,
      /\n?[^\n#;]*include\s*=\s*\/etc\/samba\/smb\.conf\.d\/[^\n]*\n?/g,
      /\n?[^\n#;]*include\s*=\s*\/etc\/samba\/openzfs-shares\.conf[^\n]*\n?/g,
      /\n?# ZFS Manager managed shares\n?/g,
      /\n?# OpenZFS Manager managed shares\n?/g,
    ];

    for (const pattern of stripPatterns) {
      conf = conf.replace(pattern, '\n');
    }

    // Now insert at the end of [global] (right before the first share section)
    // Look for the first [section] that isn't [global]
    const globalEnd = conf.search(/\n\[(?!global\])/i);
    if (globalEnd !== -1) {
      const before = conf.slice(0, globalEnd);
      const after = conf.slice(globalEnd);
      conf = before.trimEnd() + '\n\n# ZFS Manager managed shares\n' + includeLine + '\n' + after;
    } else {
      conf = conf.trimEnd() + '\n\n# ZFS Manager managed shares\n' + includeLine + '\n';
    }

    conf = conf.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
    await fs.writeFile(SMB_CONF, conf, 'utf-8');
    console.log(`[shares] Ensured include in [global]: ${includeLine}`);
  } catch (err) {
    console.error('[shares] Failed to update smb.conf:', err);
    throw new AppError(500, 'SMB_CONFIG_ERROR', 'Failed to update Samba configuration');
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
    // Don't throw — testparm exits non-zero for warnings too
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
