export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type AlertCategory = 'pool' | 'disk' | 'scrub' | 'trim' | 'space' | 'system' | 'share';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  message: string;
  details?: string;
  pool?: string;
  device?: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export type AuditAction =
  | 'login' | 'logout'
  | 'pool.create' | 'pool.destroy' | 'pool.import' | 'pool.export'
  | 'pool.scrub' | 'pool.trim'
  | 'dataset.create' | 'dataset.destroy' | 'dataset.set'
  | 'snapshot.create' | 'snapshot.destroy' | 'snapshot.rollback' | 'snapshot.clone'
  | 'user.create' | 'user.delete' | 'user.modify'
  | 'group.create' | 'group.delete' | 'group.modify'
  | 'share.create' | 'share.delete' | 'share.modify';

export interface AuditEntry {
  id: string;
  timestamp: string;
  username: string;
  action: AuditAction;
  target: string;
  details?: string;
  ip?: string;
  success: boolean;
  errorMessage?: string;
}
