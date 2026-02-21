/**
 * System group management service.
 *
 * Manages local Linux groups via standard utilities:
 *   - getent group (listing)
 *   - groupadd / groupdel (create / delete)
 *   - gpasswd -a / -d (member management)
 *
 * All commands use execFile to prevent shell injection.
 */

import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import type { SystemGroup } from '@zfs-manager/shared';
import { AppError } from '../middleware/errorHandler.js';

const execFile = promisify(execFileCb);

/** Minimum GID for regular (non-system) groups */
const MIN_REGULAR_GID = 1000;
const MAX_REGULAR_GID = 60000;

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

/**
 * List all regular (non-system) groups.
 *
 * Parses `getent group` and filters to GIDs in the regular range.
 */
export async function listGroups(): Promise<SystemGroup[]> {
  const { stdout } = await execFile('getent', ['group']);
  const lines = stdout.trim().split('\n').filter(Boolean);
  const groups: SystemGroup[] = [];

  for (const line of lines) {
    const group = parseGroupLine(line);
    if (group && group.gid >= MIN_REGULAR_GID && group.gid <= MAX_REGULAR_GID) {
      groups.push(group);
    }
  }

  return groups;
}

/**
 * Get a single group by name.
 */
export async function getGroup(name: string): Promise<SystemGroup | null> {
  try {
    const { stdout } = await execFile('getent', ['group', name]);
    return parseGroupLine(stdout.trim());
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

export interface CreateGroupParams {
  name: string;
  gid?: number;
}

/**
 * Create a new system group.
 */
export async function createGroup(params: CreateGroupParams): Promise<SystemGroup> {
  const args: string[] = [];

  if (params.gid !== undefined) {
    args.push('--gid', String(params.gid));
  }

  args.push(params.name);

  try {
    await execFile('groupadd', args);
  } catch (err: unknown) {
    const error = err as { stderr?: string };
    throw new AppError(400, 'GROUP_CREATE_FAILED', `Failed to create group: ${error.stderr ?? 'unknown error'}`);
  }

  const group = await getGroup(params.name);
  if (!group) {
    throw new AppError(500, 'GROUP_CREATE_FAILED', 'Group was created but could not be retrieved');
  }

  return group;
}

/**
 * Delete a system group.
 */
export async function deleteGroup(name: string): Promise<void> {
  try {
    await execFile('groupdel', [name]);
  } catch (err: unknown) {
    const error = err as { stderr?: string };
    throw new AppError(400, 'GROUP_DELETE_FAILED', `Failed to delete group: ${error.stderr ?? 'unknown error'}`);
  }
}

/**
 * Add a user to a group.
 */
export async function addMember(groupName: string, username: string): Promise<SystemGroup> {
  try {
    await execFile('gpasswd', ['-a', username, groupName]);
  } catch (err: unknown) {
    const error = err as { stderr?: string };
    throw new AppError(400, 'GROUP_ADD_MEMBER_FAILED', `Failed to add ${username} to ${groupName}: ${error.stderr ?? 'unknown error'}`);
  }

  const group = await getGroup(groupName);
  if (!group) {
    throw new AppError(404, 'GROUP_NOT_FOUND', `Group ${groupName} not found`);
  }

  return group;
}

/**
 * Remove a user from a group.
 */
export async function removeMember(groupName: string, username: string): Promise<SystemGroup> {
  try {
    await execFile('gpasswd', ['-d', username, groupName]);
  } catch (err: unknown) {
    const error = err as { stderr?: string };
    throw new AppError(400, 'GROUP_REMOVE_MEMBER_FAILED', `Failed to remove ${username} from ${groupName}: ${error.stderr ?? 'unknown error'}`);
  }

  const group = await getGroup(groupName);
  if (!group) {
    throw new AppError(404, 'GROUP_NOT_FOUND', `Group ${groupName} not found`);
  }

  return group;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a single line from /etc/group (or getent group output).
 * Format: groupname:x:gid:member1,member2,...
 */
function parseGroupLine(line: string): SystemGroup | null {
  const parts = line.split(':');
  if (parts.length < 4) return null;

  const [name, , gidStr, membersStr] = parts;

  return {
    gid: parseInt(gidStr, 10),
    name,
    members: membersStr ? membersStr.split(',').filter(Boolean) : [],
  };
}
