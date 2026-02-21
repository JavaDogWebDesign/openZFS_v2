-- =============================================================================
-- ZFS Storage Manager - Database Schema
-- =============================================================================
-- SQLite database schema for session management, audit logging, alerts,
-- and scheduled task tracking.
-- =============================================================================

-- Active user sessions
CREATE TABLE IF NOT EXISTS sessions (
    id              TEXT PRIMARY KEY,
    username        TEXT NOT NULL,
    uid             INTEGER NOT NULL,
    gid             INTEGER NOT NULL,
    groups_json     TEXT NOT NULL DEFAULT '[]',  -- JSON array of group names
    is_admin        INTEGER NOT NULL DEFAULT 0,  -- boolean: 1 = admin
    ip              TEXT,
    user_agent      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_username ON sessions(username);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Audit log for all significant actions
CREATE TABLE IF NOT EXISTS audit_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp       TEXT NOT NULL DEFAULT (datetime('now')),
    username        TEXT NOT NULL,
    action          TEXT NOT NULL,       -- e.g. 'pool.create', 'snapshot.destroy'
    target          TEXT NOT NULL,       -- e.g. pool name, dataset path
    details         TEXT,                -- JSON string with extra context
    ip              TEXT,
    success         INTEGER NOT NULL DEFAULT 1,
    error_message   TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_username ON audit_log(username);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- System and ZFS alerts
CREATE TABLE IF NOT EXISTS alerts (
    id              TEXT PRIMARY KEY,
    severity        TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    category        TEXT NOT NULL CHECK (category IN ('pool', 'disk', 'scrub', 'trim', 'space', 'system', 'share')),
    message         TEXT NOT NULL,
    details         TEXT,
    pool            TEXT,
    device          TEXT,
    timestamp       TEXT NOT NULL DEFAULT (datetime('now')),
    acknowledged    INTEGER NOT NULL DEFAULT 0,
    acknowledged_by TEXT,
    acknowledged_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_category ON alerts(category);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp);

-- Scrub schedules
CREATE TABLE IF NOT EXISTS scrub_schedules (
    id              TEXT PRIMARY KEY,
    pool            TEXT NOT NULL UNIQUE,
    cron_expression TEXT NOT NULL,
    enabled         INTEGER NOT NULL DEFAULT 1,
    last_run        TEXT,
    next_run        TEXT
);

-- Trim schedules
CREATE TABLE IF NOT EXISTS trim_schedules (
    id              TEXT PRIMARY KEY,
    pool            TEXT NOT NULL UNIQUE,
    cron_expression TEXT NOT NULL,
    enabled         INTEGER NOT NULL DEFAULT 1,
    last_run        TEXT,
    next_run        TEXT
);

-- Scrub history log
CREATE TABLE IF NOT EXISTS scrub_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    pool            TEXT NOT NULL,
    start_time      TEXT NOT NULL,
    end_time        TEXT,
    bytes_scanned   INTEGER DEFAULT 0,
    bytes_issued    INTEGER DEFAULT 0,
    errors          INTEGER DEFAULT 0,
    duration        INTEGER DEFAULT 0   -- seconds
);

CREATE INDEX IF NOT EXISTS idx_scrub_history_pool ON scrub_history(pool);
CREATE INDEX IF NOT EXISTS idx_scrub_history_start ON scrub_history(start_time);

-- Trim history log
CREATE TABLE IF NOT EXISTS trim_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    pool            TEXT NOT NULL,
    start_time      TEXT NOT NULL,
    end_time        TEXT,
    state           TEXT NOT NULL DEFAULT 'running'
);

CREATE INDEX IF NOT EXISTS idx_trim_history_pool ON trim_history(pool);
CREATE INDEX IF NOT EXISTS idx_trim_history_start ON trim_history(start_time);
