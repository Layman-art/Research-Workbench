export const SCHEMA_VERSION = 1;

export const SCHEMA_V1 = [
  `CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('generic','todo','schedule','direction','project')),
    icon TEXT NOT NULL,
    note TEXT NOT NULL,
    builtin INTEGER NOT NULL CHECK (builtin IN (0,1)),
    sort_order INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    builtin INTEGER NOT NULL CHECK (builtin IN (0,1)),
    sort_order INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    type_id TEXT NOT NULL REFERENCES types(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('planned','active','paused','done')),
    starred INTEGER NOT NULL CHECK (starred IN (0,1)),
    archived INTEGER NOT NULL CHECK (archived IN (0,1)),
    priority TEXT NOT NULL CHECK (priority IN ('none','low','medium','high')),
    due_date TEXT,
    done INTEGER NOT NULL CHECK (done IN (0,1)),
    plan_date TEXT,
    plan_start TEXT,
    plan_end TEXT,
    sub TEXT CHECK (sub IS NULL OR sub IN ('vertical','horizontal')),
    project_id TEXT REFERENCES records(id) ON DELETE SET NULL,
    recurrence_frequency TEXT CHECK (recurrence_frequency IS NULL OR recurrence_frequency IN ('daily','weekly','monthly')),
    recurrence_interval INTEGER CHECK (recurrence_interval IS NULL OR recurrence_interval > 0),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    sort_order REAL
  )`,
  `CREATE INDEX IF NOT EXISTS records_type_id_idx ON records(type_id)`,
  `CREATE INDEX IF NOT EXISTS records_workspace_id_idx ON records(workspace_id)`,
  `CREATE INDEX IF NOT EXISTS records_project_id_idx ON records(project_id)`,
  `CREATE INDEX IF NOT EXISTS records_due_date_idx ON records(due_date)`,
  `CREATE TABLE IF NOT EXISTS record_fields (
    id TEXT NOT NULL,
    record_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    PRIMARY KEY (record_id, id)
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY,
    record_id TEXT REFERENCES records(id) ON DELETE SET NULL,
    payload TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS literature_details (
    record_id TEXT PRIMARY KEY REFERENCES records(id) ON DELETE CASCADE,
    authors TEXT NOT NULL,
    year INTEGER,
    doi TEXT NOT NULL,
    url TEXT NOT NULL,
    reading_status TEXT NOT NULL CHECK (reading_status IN ('unread','reading','read'))
  )`,
  `CREATE TABLE IF NOT EXISTS notification_deliveries (
    record_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    occurrence_key TEXT NOT NULL,
    delivered_at INTEGER NOT NULL,
    PRIMARY KEY (record_id, occurrence_key)
  )`,
] as const;
