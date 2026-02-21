/**
 * System user management service.
 *
 * Manages local Linux users via standard utilities:
 *   - getent passwd (listing)
 *   - useradd / userdel / usermod (CRUD)
 *   - chpasswd (password changes)
 *   - smbpasswd (Samba password management)
 *
 * All commands use execFile to prevent shell injection.
 */

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import type { SystemUser } from '@zfs-manager/shared';
import { AppError } from '../middleware/errorHandler.js';

const execFile = promisify(execFileCb);

/** Minimum UID for "regular" (non-system) users. Distro-dependent; 1000 is standard. */
const MIN_REGULAR_UID = 1000;

/** Maximum UID to consider (exclude nobody / overflow) */
const MAX_REGULAR_UID = 60000;

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

/**
 * List all regular (non-system) users.
 *
 * Parses `getent passwd` and filters to UIDs in the regular range.
 */
export async function listUsers(): Promise<SystemUser[]> {
  const { stdout } = await execFile('getent', ['passwd']);
  const lines = stdout.trim().split('\n').filter(Boolean);
  const users: SystemUser[] = [];

  for (const line of lines) {
    const user = parsePasswdLine(line);
    if (user && user.uid >= MIN_REGULAR_UID && user.uid <= MAX_REGULAR_UID) {
      // Fetch group memberships
      user.groups = await getUserGroups(user.username);
      user.smbEnabled = await isSmbEnabled(user.username);
      users.push(user);
    }
  }

  return users;
}

/**
 * Get a single user by username.
 */
export async function getUser(username: string): Promise<SystemUser | null> {
  try {
    const { stdout } = await execFile('getent', ['passwd', username]);
    const user = parsePasswdLine(stdout.trim());
    if (!user) return null;

    user.groups = await getUserGroups(username);
    user.smbEnabled = await isSmbEnabled(username);
    return user;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

export interface CreateUserParams {
  username: string;
  fullName?: string;
  shell?: string;
  homeDir?: string;
  groups?: string[];
  createHome?: boolean;
}

/**
 * Create a new system user.
 */
export async function createUser(params: CreateUserParams): Promise<SystemUser> {
  const args = ['--create-home'];

  if (params.fullName) {
    args.push('--comment', params.fullName);
  }
  if (params.shell) {
    args.push('--shell', params.shell);
  }
  if (params.homeDir) {
    args.push('--home-dir', params.homeDir);
  }
  if (params.groups && params.groups.length > 0) {
    args.push('--groups', params.groups.join(','));
  }

  args.push(params.username);

  try {
    await execFile('useradd', args);
  } catch (err: unknown) {
    const error = err as { stderr?: string };
    throw new AppError(400, 'USER_CREATE_FAILED', `Failed to create user: ${error.stderr ?? 'unknown error'}`);
  }

  const user = await getUser(params.username);
  if (!user) {
    throw new AppError(500, 'USER_CREATE_FAILED', 'User was created but could not be retrieved');
  }

  return user;
}

/**
 * Delete a system user.
 *
 * @param removeHome - If true, also remove the user's home directory.
 */
export async function deleteUser(username: string, removeHome = false): Promise<void> {
  const args: string[] = [];
  if (removeHome) {
    args.push('--remove');
  }
  args.push(username);

  try {
    await execFile('userdel', args);
  } catch (err: unknown) {
    const error = err as { stderr?: string };
    throw new AppError(400, 'USER_DELETE_FAILED', `Failed to delete user: ${error.stderr ?? 'unknown error'}`);
  }
}

export interface ModifyUserParams {
  fullName?: string;
  shell?: string;
  homeDir?: string;
  groups?: string[];
  locked?: boolean;
}

/**
 * Modify an existing user's properties.
 */
export async function modifyUser(username: string, params: ModifyUserParams): Promise<SystemUser> {
  const args: string[] = [];

  if (params.fullName !== undefined) {
    args.push('--comment', params.fullName);
  }
  if (params.shell !== undefined) {
    args.push('--shell', params.shell);
  }
  if (params.homeDir !== undefined) {
    args.push('--home', params.homeDir);
  }
  if (params.groups !== undefined) {
    // Replace all supplementary groups
    args.push('--groups', params.groups.join(','));
  }
  if (params.locked === true) {
    args.push('--lock');
  } else if (params.locked === false) {
    args.push('--unlock');
  }

  if (args.length > 0) {
    args.push(username);
    try {
      await execFile('usermod', args);
    } catch (err: unknown) {
      const error = err as { stderr?: string };
      throw new AppError(400, 'USER_MODIFY_FAILED', `Failed to modify user: ${error.stderr ?? 'unknown error'}`);
    }
  }

  const user = await getUser(username);
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', `User ${username} not found after modification`);
  }

  return user;
}

/**
 * Change a user's system password via chpasswd.
 */
export async function changePassword(username: string, newPassword: string): Promise<void> {
  try {
    const child = await execFile('chpasswd', [], {
      // chpasswd reads "username:password" from stdin
    });
    // Since execFile doesn't pipe stdin easily, use a subprocess approach
    void child; // appease linter
  } catch {
    // Fall through to spawn-based approach
  }

  // Use spawn for stdin piping
  const { spawn } = await import('node:child_process');

  return new Promise<void>((resolve, reject) => {
    const proc = spawn('chpasswd', [], { stdio: ['pipe', 'pipe', 'pipe'] });

    proc.stdin.write(`${username}:${newPassword}\n`);
    proc.stdin.end();

    let stderr = '';
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new AppError(400, 'PASSWORD_CHANGE_FAILED', `Failed to change password: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(new AppError(500, 'PASSWORD_CHANGE_FAILED', `Failed to change password: ${err.message}`));
    });
  });
}

/**
 * Set or update a user's Samba password.
 */
export async function setSmbPassword(username: string, password: string): Promise<void> {
  const { spawn } = await import('node:child_process');

  return new Promise<void>((resolve, reject) => {
    const proc = spawn('smbpasswd', ['-a', '-s', username], { stdio: ['pipe', 'pipe', 'pipe'] });

    // smbpasswd -s expects the password twice on stdin
    proc.stdin.write(`${password}\n${password}\n`);
    proc.stdin.end();

    let stderr = '';
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new AppError(400, 'SMB_PASSWORD_FAILED', `Failed to set SMB password: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(new AppError(500, 'SMB_PASSWORD_FAILED', `smbpasswd not available: ${err.message}`));
    });
  });
}

/**
 * List all users that have Samba passwords set.
 */
export async function listSmbUsers(): Promise<string[]> {
  try {
    const { stdout } = await execFile('pdbedit', ['-L', '-w']);
    return stdout.trim().split('\n')
      .filter(Boolean)
      .map((line) => line.split(':')[0])
      .filter(Boolean);
  } catch {
    // pdbedit may not be installed or may require root
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a single line from /etc/passwd (or getent passwd output).
 * Format: username:x:uid:gid:full_name:home_dir:shell
 */
function parsePasswdLine(line: string): SystemUser | null {
  const parts = line.split(':');
  if (parts.length < 7) return null;

  const [username, , uidStr, gidStr, fullName, homeDir, shell] = parts;

  return {
    uid: parseInt(uidStr, 10),
    gid: parseInt(gidStr, 10),
    username,
    fullName: fullName ?? '',
    homeDir: homeDir ?? '',
    shell: shell ?? '/bin/bash',
    groups: [],
    smbEnabled: false,
    locked: false,
  };
}

/**
 * Get supplementary group names for a user.
 */
async function getUserGroups(username: string): Promise<string[]> {
  try {
    const { stdout } = await execFile('id', ['-Gn', username]);
    return stdout.trim().split(/\s+/).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Check if a user has a Samba password entry.
 */
async function isSmbEnabled(username: string): Promise<boolean> {
  try {
    const { stdout } = await execFile('pdbedit', ['-L', '-w']);
    return stdout.split('\n').some((line) => line.startsWith(username + ':'));
  } catch {
    return false;
  }
}
