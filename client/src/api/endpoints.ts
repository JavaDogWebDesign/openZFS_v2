import { apiClient } from './client';
import type {
  Pool,
  PoolDetail,
  Dataset,
  Snapshot,
  Disk,
  SMARTData,
  SystemUser,
  SystemGroup,
  SMBShare,
  NFSShare,
  IOStatEntry,
  ARCStats,
  ScrubStatus,
  ScrubSchedule,
  ScrubHistoryEntry,
  TrimStatus,
  TrimSchedule,
  TrimHistoryEntry,
  Alert,
  AuditEntry,
  SessionInfo,
  SystemInfo,
} from '@zfs-manager/shared';

// ----- Auth -----

export const authApi = {
  login(username: string, password: string) {
    return apiClient.post<SessionInfo>('/auth/login', { username, password });
  },

  logout() {
    return apiClient.post<void>('/auth/logout');
  },

  me() {
    return apiClient.get<SessionInfo>('/auth/me');
  },
};

// ----- Pools -----

export const poolApi = {
  list() {
    return apiClient.get<Pool[]>('/pools');
  },

  get(name: string) {
    return apiClient.get<PoolDetail>(`/pools/${encodeURIComponent(name)}`);
  },

  create(config: {
    name: string;
    vdevs: Array<{ type: string; disks: string[] }>;
    options?: Record<string, string>;
  }) {
    return apiClient.post<Pool>('/pools', config);
  },

  destroy(name: string, force?: boolean) {
    return apiClient.delete<void>(`/pools/${encodeURIComponent(name)}${force ? '?force=true' : ''}`);
  },

  scrub(name: string, action: 'start' | 'pause' | 'cancel' = 'start') {
    return apiClient.post<ScrubStatus>(`/pools/${encodeURIComponent(name)}/scrub`, { action });
  },

  getScrubStatus(name: string) {
    return apiClient.get<ScrubStatus>(`/pools/${encodeURIComponent(name)}/scrub`);
  },

  getScrubSchedules() {
    return apiClient.get<ScrubSchedule[]>('/scrub/schedules');
  },

  setScrubSchedule(schedule: Omit<ScrubSchedule, 'id' | 'lastRun' | 'nextRun'>) {
    return apiClient.post<ScrubSchedule>('/scrub/schedules', schedule);
  },

  deleteScrubSchedule(id: string) {
    return apiClient.delete<void>(`/scrub/schedules/${id}`);
  },

  getScrubHistory(name: string) {
    return apiClient.get<ScrubHistoryEntry[]>(`/pools/${encodeURIComponent(name)}/scrub/history`);
  },

  trim(name: string, action: 'start' | 'cancel' = 'start') {
    return apiClient.post<TrimStatus>(`/pools/${encodeURIComponent(name)}/trim`, { action });
  },

  getTrimStatus(name: string) {
    return apiClient.get<TrimStatus>(`/pools/${encodeURIComponent(name)}/trim`);
  },

  getTrimSchedules() {
    return apiClient.get<TrimSchedule[]>('/trim/schedules');
  },

  setTrimSchedule(schedule: Omit<TrimSchedule, 'id' | 'lastRun' | 'nextRun'>) {
    return apiClient.post<TrimSchedule>('/trim/schedules', schedule);
  },

  deleteTrimSchedule(id: string) {
    return apiClient.delete<void>(`/trim/schedules/${id}`);
  },

  getTrimHistory(name: string) {
    return apiClient.get<TrimHistoryEntry[]>(`/pools/${encodeURIComponent(name)}/trim/history`);
  },

  importPool(name: string, options?: { force?: boolean }) {
    return apiClient.post<Pool>('/pools/import', { name, ...options });
  },

  exportPool(name: string, options?: { force?: boolean }) {
    return apiClient.post<void>(`/pools/${encodeURIComponent(name)}/export`, options);
  },
};

// ----- Datasets -----

export const datasetApi = {
  list(pool?: string) {
    const query = pool ? `?pool=${encodeURIComponent(pool)}` : '';
    return apiClient.get<Dataset[]>(`/datasets${query}`);
  },

  get(name: string) {
    return apiClient.get<Dataset>(`/datasets/${encodeURIComponent(name)}`);
  },

  create(config: { name: string; properties?: Record<string, string> }) {
    return apiClient.post<Dataset>('/datasets', config);
  },

  update(name: string, properties: Record<string, string>) {
    return apiClient.patch<Dataset>(`/datasets/${encodeURIComponent(name)}`, { properties });
  },

  destroy(name: string, options?: { recursive?: boolean }) {
    const query = options?.recursive ? '?recursive=true' : '';
    return apiClient.delete<void>(`/datasets/${encodeURIComponent(name)}${query}`);
  },
};

// ----- Snapshots -----

export const snapshotApi = {
  list(dataset?: string) {
    const query = dataset ? `?dataset=${encodeURIComponent(dataset)}` : '';
    return apiClient.get<Snapshot[]>(`/snapshots${query}`);
  },

  create(config: { dataset: string; name: string; recursive?: boolean }) {
    return apiClient.post<Snapshot>('/snapshots', config);
  },

  destroy(name: string, options?: { recursive?: boolean }) {
    const query = options?.recursive ? '?recursive=true' : '';
    return apiClient.delete<void>(`/snapshots/${encodeURIComponent(name)}${query}`);
  },

  rollback(name: string, options?: { destroyMoreRecent?: boolean }) {
    return apiClient.post<void>(`/snapshots/${encodeURIComponent(name)}/rollback`, options);
  },

  clone(name: string, target: string, options?: { mountpoint?: string }) {
    return apiClient.post<Dataset>(`/snapshots/${encodeURIComponent(name)}/clone`, {
      target,
      ...options,
    });
  },
};

// ----- Disks -----

export const diskApi = {
  list() {
    return apiClient.get<Disk[]>('/disks');
  },

  get(name: string) {
    return apiClient.get<Disk>(`/disks/${encodeURIComponent(name)}`);
  },

  getSmart(name: string) {
    return apiClient.get<SMARTData>(`/disks/${encodeURIComponent(name)}/smart`);
  },
};

// ----- Users -----

export const userApi = {
  list() {
    return apiClient.get<SystemUser[]>('/users');
  },

  get(username: string) {
    return apiClient.get<SystemUser>(`/users/${encodeURIComponent(username)}`);
  },

  create(config: {
    username: string;
    password: string;
    fullName?: string;
    shell?: string;
    groups?: string[];
    createHome?: boolean;
  }) {
    return apiClient.post<SystemUser>('/users', config);
  },

  update(username: string, data: {
    fullName?: string;
    shell?: string;
    groups?: string[];
    password?: string;
    locked?: boolean;
  }) {
    return apiClient.put<SystemUser>(`/users/${encodeURIComponent(username)}`, data);
  },

  destroy(username: string, options?: { removeHome?: boolean }) {
    const query = options?.removeHome ? '?removeHome=true' : '';
    return apiClient.delete<void>(`/users/${encodeURIComponent(username)}${query}`);
  },

  setSmbPassword(username: string, password: string) {
    return apiClient.post<void>(`/users/${encodeURIComponent(username)}/smb-password`, { password });
  },
};

// ----- Groups -----

export const groupApi = {
  list() {
    return apiClient.get<SystemGroup[]>('/groups');
  },

  get(name: string) {
    return apiClient.get<SystemGroup>(`/groups/${encodeURIComponent(name)}`);
  },

  create(config: { name: string; gid?: number; members?: string[] }) {
    return apiClient.post<SystemGroup>('/groups', config);
  },

  update(name: string, data: { members?: string[] }) {
    return apiClient.put<SystemGroup>(`/groups/${encodeURIComponent(name)}`, data);
  },

  destroy(name: string) {
    return apiClient.delete<void>(`/groups/${encodeURIComponent(name)}`);
  },

  addMember(groupName: string, username: string) {
    return apiClient.post<SystemGroup>(`/groups/${encodeURIComponent(groupName)}/members`, { username });
  },

  removeMember(groupName: string, username: string) {
    return apiClient.delete<SystemGroup>(
      `/groups/${encodeURIComponent(groupName)}/members/${encodeURIComponent(username)}`,
    );
  },
};

// ----- Shares -----

export const shareApi = {
  listSmb() {
    return apiClient.get<SMBShare[]>('/shares/smb');
  },

  createSmb(config: Omit<SMBShare, 'enabled'> & { enabled?: boolean }) {
    return apiClient.post<SMBShare>('/shares/smb', config);
  },

  updateSmb(name: string, data: Partial<SMBShare>) {
    return apiClient.put<SMBShare>(`/shares/smb/${encodeURIComponent(name)}`, data);
  },

  deleteSmb(name: string) {
    return apiClient.delete<void>(`/shares/smb/${encodeURIComponent(name)}`);
  },

  listNfs() {
    return apiClient.get<NFSShare[]>('/shares/nfs');
  },

  createNfs(config: Omit<NFSShare, 'enabled'> & { enabled?: boolean }) {
    return apiClient.post<NFSShare>('/shares/nfs', config);
  },

  updateNfs(path: string, data: Partial<NFSShare>) {
    return apiClient.put<NFSShare>(`/shares/nfs/${encodeURIComponent(path)}`, data);
  },

  deleteNfs(path: string) {
    return apiClient.delete<void>(`/shares/nfs/${encodeURIComponent(path)}`);
  },
};

// ----- Monitoring -----

export const monitoringApi = {
  arc() {
    return apiClient.get<ARCStats>('/monitoring/arc');
  },

  iostat(pool?: string) {
    const query = pool ? `?pool=${encodeURIComponent(pool)}` : '';
    return apiClient.get<IOStatEntry[]>(`/monitoring/iostat${query}`);
  },

  alerts() {
    return apiClient.get<Alert[]>('/monitoring/alerts');
  },

  acknowledgeAlert(id: string) {
    return apiClient.post<Alert>(`/monitoring/alerts/${id}/acknowledge`);
  },

  system() {
    return apiClient.get<SystemInfo>('/monitoring/system');
  },

  auditLog(options?: { page?: number; pageSize?: number }) {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', String(options.page));
    if (options?.pageSize) params.set('pageSize', String(options.pageSize));
    const query = params.toString() ? `?${params}` : '';
    return apiClient.get<AuditEntry[]>(`/monitoring/audit${query}`);
  },
};
