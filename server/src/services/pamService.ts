/**
 * PAM authentication service.
 *
 * Authenticates local system users against PAM. This is used for the
 * web login flow -- the user provides their Linux username + password,
 * and we verify credentials via PAM before creating a session.
 *
 * Implementation note:
 *   Native PAM bindings (e.g. authenticate-pam) require a compiled native
 *   module. For portability, this stub also supports falling back to
 *   `su -c true <user>` which prompts for the password via stdin, though
 *   this is less secure and should only be used in development.
 *
 * TODO: Replace the subprocess-based fallback with a proper PAM native
 *       binding for production use (e.g. node-linux-pam or authenticate-pam).
 */

import { execFile as execFileCb, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

export interface AuthResult {
  success: boolean;
  uid: number;
  gid: number;
  groups: string[];
  isAdmin: boolean;
  error?: string;
}

/**
 * Authenticate a user against PAM / the local system.
 *
 * @param username - The Linux username.
 * @param password - The plaintext password (transmitted over TLS in production).
 * @returns An AuthResult indicating success or failure plus user metadata.
 */
export async function authenticate(username: string, password: string): Promise<AuthResult> {
  // Validate inputs before doing anything
  if (!username || !password) {
    return { success: false, uid: -1, gid: -1, groups: [], isAdmin: false, error: 'Username and password are required' };
  }

  // Reject usernames with shell metacharacters (defense in depth)
  if (/[^a-zA-Z0-9._-]/.test(username)) {
    return { success: false, uid: -1, gid: -1, groups: [], isAdmin: false, error: 'Invalid username' };
  }

  try {
    // Attempt authentication using `su`
    // We spawn `su` with the target user and pass the password via stdin.
    const authenticated = await verifyPasswordViaSu(username, password);

    if (!authenticated) {
      return { success: false, uid: -1, gid: -1, groups: [], isAdmin: false, error: 'Invalid credentials' };
    }

    // Fetch user metadata
    const userInfo = await getUserInfo(username);

    return {
      success: true,
      ...userInfo,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Authentication failed';
    return { success: false, uid: -1, gid: -1, groups: [], isAdmin: false, error: message };
  }
}

/**
 * Verify a password by attempting `su -c true <username>`.
 *
 * This is a subprocess-based fallback. In production, replace with a
 * native PAM binding for better security and performance.
 */
function verifyPasswordViaSu(username: string, password: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('su', ['-c', 'true', username], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Send the password to stdin
    child.stdin.write(password + '\n');
    child.stdin.end();

    child.on('close', (code) => {
      resolve(code === 0);
    });

    child.on('error', () => {
      resolve(false);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      child.kill();
      resolve(false);
    }, 10_000);
  });
}

/**
 * Look up uid, gid, and group memberships for a user.
 */
async function getUserInfo(username: string): Promise<{ uid: number; gid: number; groups: string[]; isAdmin: boolean }> {
  // Get uid and gid from `id` command
  const { stdout: idOutput } = await execFile('id', [username]);

  const uidMatch = idOutput.match(/uid=(\d+)/);
  const gidMatch = idOutput.match(/gid=(\d+)/);

  const uid = uidMatch ? parseInt(uidMatch[1], 10) : -1;
  const gid = gidMatch ? parseInt(gidMatch[1], 10) : -1;

  // Get group names from `id -Gn`
  const { stdout: groupsOutput } = await execFile('id', ['-Gn', username]);
  const groups = groupsOutput.trim().split(/\s+/).filter(Boolean);

  // Admin detection: uid 0 or member of sudo/wheel group
  const isAdmin = uid === 0 || groups.includes('sudo') || groups.includes('wheel') || groups.includes('root');

  return { uid, gid, groups, isAdmin };
}
