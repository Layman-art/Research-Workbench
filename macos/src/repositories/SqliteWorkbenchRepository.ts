import type {
  AppSettings,
  CustomField,
  Draft,
  LiteratureDetails,
  RecordItem,
  RecurrenceFrequency,
  TypeDef,
  WorkbenchSnapshot,
  Workspace,
} from '../domain/models';
import type { BatchRecordPatch, WorkbenchRepository } from './WorkbenchRepository';
import { SCHEMA_V1, SCHEMA_VERSION } from './schema';
import { completeTodoRecords } from '../features/todos/completeTodo';

export interface SqlResult {
  rowsAffected: number;
  lastInsertId?: number;
}

export interface SqlExecutor {
  select<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<SqlResult>;
  transaction<T>(work: (transaction: SqlExecutor) => Promise<T>): Promise<T>;
}

export interface RecordRow {
  id: string;
  type_id: string;
  workspace_id: string;
  title: string;
  content: string;
  status: RecordItem['status'];
  starred: number;
  archived: number;
  priority: RecordItem['priority'];
  due_date: string | null;
  done: number;
  plan_date: string | null;
  plan_start: string | null;
  plan_end: string | null;
  sub: RecordItem['sub'];
  project_id: string | null;
  recurrence_frequency: RecurrenceFrequency | null;
  recurrence_interval: number | null;
  created_at: number;
  updated_at: number;
  sort_order: number | null;
  fields_json: string;
  literature_json: string | null;
}

function parseJson<T>(value: string, label: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`${label}不是有效的 JSON`);
  }
}

function validateRecurrence(frequency: RecurrenceFrequency | null, interval: number | null): void {
  if ((frequency === null) !== (interval === null)) {
    throw new Error('重复频率和间隔必须同时设置');
  }
  if (interval !== null && (!Number.isInteger(interval) || interval <= 0)) {
    throw new Error('重复间隔必须大于 0');
  }
}

export function recordToRow(record: RecordItem): RecordRow {
  const recurrenceFrequency = record.recurrence?.frequency ?? null;
  const recurrenceInterval = record.recurrence?.interval ?? null;
  validateRecurrence(recurrenceFrequency, recurrenceInterval);

  return {
    id: record.id,
    type_id: record.typeId,
    workspace_id: record.workspaceId,
    title: record.title,
    content: record.content,
    status: record.status,
    starred: record.starred ? 1 : 0,
    archived: record.archived ? 1 : 0,
    priority: record.priority,
    due_date: record.dueDate,
    done: record.done ? 1 : 0,
    plan_date: record.planDate,
    plan_start: record.planStart,
    plan_end: record.planEnd,
    sub: record.sub ?? null,
    project_id: record.projectId,
    recurrence_frequency: recurrenceFrequency,
    recurrence_interval: recurrenceInterval,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    sort_order: record.order ?? null,
    fields_json: JSON.stringify(record.fields),
    literature_json: record.literature ? JSON.stringify(record.literature) : null,
  };
}

export function rowToRecord(row: RecordRow): RecordItem {
  validateRecurrence(row.recurrence_frequency, row.recurrence_interval);
  const fields = parseJson<CustomField[]>(row.fields_json, '自定义字段');
  if (!Array.isArray(fields)) throw new Error('自定义字段必须是数组');
  const literature = row.literature_json
    ? parseJson<LiteratureDetails>(row.literature_json, '文献元数据')
    : null;

  return {
    id: row.id,
    typeId: row.type_id,
    workspaceId: row.workspace_id,
    title: row.title,
    content: row.content,
    status: row.status,
    starred: row.starred === 1,
    archived: row.archived === 1,
    fields,
    priority: row.priority,
    dueDate: row.due_date,
    done: row.done === 1,
    planDate: row.plan_date,
    planStart: row.plan_start,
    planEnd: row.plan_end,
    sub: row.sub,
    projectId: row.project_id,
    recurrence:
      row.recurrence_frequency && row.recurrence_interval
        ? { frequency: row.recurrence_frequency, interval: row.recurrence_interval }
        : null,
    literature,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.sort_order === null ? {} : { order: row.sort_order }),
  };
}

interface TypeRow {
  id: string;
  name: string;
  kind: TypeDef['kind'];
  icon: string;
  note: string;
  builtin: number;
}

interface WorkspaceRow {
  id: string;
  name: string;
  builtin: number;
}

interface FieldRow {
  id: string;
  record_id: string;
  name: string;
  value: string;
}

interface LiteratureRow {
  record_id: string;
  authors: string;
  year: number | null;
  doi: string;
  url: string;
  reading_status: LiteratureDetails['readingStatus'];
}

interface SettingRow {
  value: string;
}

interface DraftRow {
  id: string;
  record_id: string | null;
  payload: string;
  updated_at: number;
}

type StoredRecordRow = Omit<RecordRow, 'fields_json' | 'literature_json'>;

const RECORD_COLUMNS = `id, type_id, workspace_id, title, content, status, starred, archived,
  priority, due_date, done, plan_date, plan_start, plan_end, sub, project_id,
  recurrence_frequency, recurrence_interval, created_at, updated_at, sort_order`;

const RECORD_UPSERT = `INSERT INTO records (${RECORD_COLUMNS})
  VALUES (${Array.from({ length: 21 }, () => '?').join(', ')})
  ON CONFLICT(id) DO UPDATE SET
    type_id=excluded.type_id, workspace_id=excluded.workspace_id, title=excluded.title,
    content=excluded.content, status=excluded.status, starred=excluded.starred,
    archived=excluded.archived, priority=excluded.priority, due_date=excluded.due_date,
    done=excluded.done, plan_date=excluded.plan_date, plan_start=excluded.plan_start,
    plan_end=excluded.plan_end, sub=excluded.sub, project_id=excluded.project_id,
    recurrence_frequency=excluded.recurrence_frequency,
    recurrence_interval=excluded.recurrence_interval, created_at=excluded.created_at,
    updated_at=excluded.updated_at, sort_order=excluded.sort_order`;

function rowParams(row: RecordRow, projectId = row.project_id): unknown[] {
  return [
    row.id,
    row.type_id,
    row.workspace_id,
    row.title,
    row.content,
    row.status,
    row.starred,
    row.archived,
    row.priority,
    row.due_date,
    row.done,
    row.plan_date,
    row.plan_start,
    row.plan_end,
    row.sub ?? null,
    projectId,
    row.recurrence_frequency,
    row.recurrence_interval,
    row.created_at,
    row.updated_at,
    row.sort_order,
  ];
}

function validateSnapshot(snapshot: WorkbenchSnapshot): void {
  const typeIds = new Set(snapshot.types.map((type) => type.id));
  const workspaceIds = new Set(snapshot.workspaces.map((workspace) => workspace.id));
  const recordIds = new Set(snapshot.records.map((record) => record.id));
  const unique = (items: Array<{ id: string }>) => new Set(items.map((item) => item.id)).size;
  if (unique(snapshot.types) !== snapshot.types.length || unique(snapshot.workspaces) !== snapshot.workspaces.length || unique(snapshot.records) !== snapshot.records.length) {
    throw new Error('快照中存在重复 ID');
  }
  for (const record of snapshot.records) {
    if (!typeIds.has(record.typeId) || !workspaceIds.has(record.workspaceId)) {
      throw new Error(`记录「${record.title}」引用了不存在的类型或工作区`);
    }
    if (record.projectId && (!recordIds.has(record.projectId) || record.projectId === record.id)) {
      throw new Error(`记录「${record.title}」引用了无效项目`);
    }
    recordToRow(record);
  }
}

async function writeType(executor: SqlExecutor, type: TypeDef, order: number): Promise<void> {
  await executor.execute(
    `INSERT INTO types (id, name, kind, icon, note, builtin, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, kind=excluded.kind,
       icon=excluded.icon, note=excluded.note, builtin=excluded.builtin,
       sort_order=excluded.sort_order`,
    [type.id, type.name, type.kind, type.icon, type.note, type.builtin ? 1 : 0, order],
  );
}

async function writeWorkspace(
  executor: SqlExecutor,
  workspace: Workspace,
  order: number,
): Promise<void> {
  await executor.execute(
    `INSERT INTO workspaces (id, name, builtin, sort_order) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, builtin=excluded.builtin,
       sort_order=excluded.sort_order`,
    [workspace.id, workspace.name, workspace.builtin ? 1 : 0, order],
  );
}

async function writeRecord(
  executor: SqlExecutor,
  record: RecordItem,
  deferProjectLink = false,
): Promise<void> {
  const row = recordToRow(record);
  await executor.execute(RECORD_UPSERT, rowParams(row, deferProjectLink ? null : row.project_id));
  await executor.execute('DELETE FROM record_fields WHERE record_id = ?', [record.id]);
  for (const [order, field] of record.fields.entries()) {
    await executor.execute(
      `INSERT INTO record_fields (id, record_id, name, value, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [field.id, record.id, field.name, field.value, order],
    );
  }
  await executor.execute('DELETE FROM literature_details WHERE record_id = ?', [record.id]);
  if (record.literature) {
    await executor.execute(
      `INSERT INTO literature_details
       (record_id, authors, year, doi, url, reading_status) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.literature.authors,
        record.literature.year,
        record.literature.doi,
        record.literature.url,
        record.literature.readingStatus,
      ],
    );
  }
}

async function readRecord(executor: SqlExecutor, id: string): Promise<RecordItem | null> {
  const [row] = await executor.select<StoredRecordRow>(
    `SELECT ${RECORD_COLUMNS} FROM records WHERE id = ?`,
    [id],
  );
  if (!row) return null;
  const fields = await executor.select<FieldRow>(
    'SELECT id, record_id, name, value FROM record_fields WHERE record_id = ? ORDER BY sort_order',
    [id],
  );
  const [literature] = await executor.select<LiteratureRow>(
    'SELECT * FROM literature_details WHERE record_id = ?',
    [id],
  );
  return rowToRecord({
    ...row,
    fields_json: JSON.stringify(
      fields.map((field) => ({ id: field.id, name: field.name, value: field.value })),
    ),
    literature_json: literature
      ? JSON.stringify({
          authors: literature.authors,
          year: literature.year,
          doi: literature.doi,
          url: literature.url,
          readingStatus: literature.reading_status,
        } satisfies LiteratureDetails)
      : null,
  });
}

async function writeSettings(executor: SqlExecutor, settings: AppSettings): Promise<void> {
  await executor.execute(
    `INSERT INTO settings (key, value) VALUES ('app', ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    [JSON.stringify(settings)],
  );
}

export class SqliteWorkbenchRepository implements WorkbenchRepository {
  constructor(
    private readonly executor: SqlExecutor,
    private readonly buildInitialSnapshot: () => WorkbenchSnapshot,
  ) {}

  async initialize(): Promise<void> {
    await this.executor.execute('PRAGMA foreign_keys = ON');
    await this.executor.transaction(async (transaction) => {
      for (const statement of SCHEMA_V1) await transaction.execute(statement);
      await transaction.execute(
        'INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        [SCHEMA_VERSION, Date.now()],
      );
    });
    const [{ count = 0 } = {}] = await this.executor.select<{ count: number }>(
      'SELECT COUNT(*) AS count FROM types',
    );
    if (Number(count) === 0) await this.replaceAll(this.buildInitialSnapshot());
  }

  async loadSnapshot(): Promise<WorkbenchSnapshot> {
    const [recordRows, fieldRows, literatureRows, typeRows, workspaceRows, settingRows] =
      await Promise.all([
        this.executor.select<StoredRecordRow>(`SELECT ${RECORD_COLUMNS} FROM records`),
        this.executor.select<FieldRow>(
          'SELECT id, record_id, name, value FROM record_fields ORDER BY sort_order',
        ),
        this.executor.select<LiteratureRow>('SELECT * FROM literature_details'),
        this.executor.select<TypeRow>('SELECT * FROM types ORDER BY sort_order'),
        this.executor.select<WorkspaceRow>('SELECT * FROM workspaces ORDER BY sort_order'),
        this.executor.select<SettingRow>("SELECT value FROM settings WHERE key = 'app'"),
      ]);
    const fieldsByRecord = new Map<string, CustomField[]>();
    for (const field of fieldRows) {
      const fields = fieldsByRecord.get(field.record_id) ?? [];
      fields.push({ id: field.id, name: field.name, value: field.value });
      fieldsByRecord.set(field.record_id, fields);
    }
    const literatureByRecord = new Map(
      literatureRows.map((item) => [
        item.record_id,
        {
          authors: item.authors,
          year: item.year,
          doi: item.doi,
          url: item.url,
          readingStatus: item.reading_status,
        } satisfies LiteratureDetails,
      ]),
    );
    const fallback = this.buildInitialSnapshot();
    return {
      records: recordRows.map((row) =>
        rowToRecord({
          ...row,
          fields_json: JSON.stringify(fieldsByRecord.get(row.id) ?? []),
          literature_json: literatureByRecord.has(row.id)
            ? JSON.stringify(literatureByRecord.get(row.id))
            : null,
        }),
      ),
      types: typeRows.map((row) => ({ ...row, builtin: row.builtin === 1 })),
      workspaces: workspaceRows.map((row) => ({ ...row, builtin: row.builtin === 1 })),
      settings: settingRows[0]
        ? parseJson<AppSettings>(settingRows[0].value, '设置')
        : fallback.settings,
    };
  }

  async saveRecord(record: RecordItem): Promise<void> {
    await this.executor.transaction((transaction) => writeRecord(transaction, record));
  }

  async deleteRecord(id: string): Promise<void> {
    await this.executor.execute('DELETE FROM records WHERE id = ?', [id]);
  }

  async completeTodo(id: string, completedAt: number) {
    const record = await readRecord(this.executor, id);
    if (!record) throw new Error('待办不存在');
    const result = completeTodoRecords(record, completedAt, crypto.randomUUID());
    await this.executor.transaction(async (transaction) => {
      await writeRecord(transaction, result.completed);
      if (result.next) await writeRecord(transaction, result.next);
    });
    return result;
  }

  async updateRecords(ids: string[], patch: BatchRecordPatch): Promise<RecordItem[]> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return [];
    return this.executor.transaction(async (transaction) => {
      if (patch.workspaceId) {
        const [{ count = 0 } = {}] = await transaction.select<{ count: number }>(
          'SELECT COUNT(*) AS count FROM workspaces WHERE id = ?', [patch.workspaceId],
        );
        if (Number(count) !== 1) throw new Error('目标工作区不存在');
      }
      if (patch.projectId) {
        const project = await readRecord(transaction, patch.projectId);
        if (!project) throw new Error('目标项目不存在');
      }
      const records: RecordItem[] = [];
      for (const id of uniqueIds) {
        const record = await readRecord(transaction, id);
        if (!record) throw new Error('部分记录不存在');
        records.push(record);
      }
      const updatedAt = Date.now();
      const updated = records.map((record) => ({ ...record, ...patch, updatedAt }));
      for (const record of updated) await writeRecord(transaction, record);
      return updated;
    });
  }

  async deleteRecords(ids: string[]): Promise<void> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return;
    await this.executor.transaction(async (transaction) => {
      for (const id of uniqueIds) {
        const [{ count = 0 } = {}] = await transaction.select<{ count: number }>(
          'SELECT COUNT(*) AS count FROM records WHERE id = ?', [id],
        );
        if (Number(count) !== 1) throw new Error('部分记录不存在');
      }
      for (const id of uniqueIds) await transaction.execute('DELETE FROM records WHERE id = ?', [id]);
    });
  }

  async reserveReminder(recordId: string, occurrenceKey: string, deliveredAt: number): Promise<boolean> {
    const result = await this.executor.execute(
      `INSERT OR IGNORE INTO notification_deliveries (record_id, occurrence_key, delivered_at)
       VALUES (?, ?, ?)`,
      [recordId, occurrenceKey, deliveredAt],
    );
    return result.rowsAffected === 1;
  }

  async replaceAll(snapshot: WorkbenchSnapshot): Promise<void> {
    validateSnapshot(snapshot);
    await this.executor.transaction(async (transaction) => {
      await transaction.execute('DELETE FROM records');
      await transaction.execute('DELETE FROM types');
      await transaction.execute('DELETE FROM workspaces');
      for (const [order, type] of snapshot.types.entries()) {
        await writeType(transaction, type, order);
      }
      for (const [order, workspace] of snapshot.workspaces.entries()) {
        await writeWorkspace(transaction, workspace, order);
      }
      for (const record of snapshot.records) await writeRecord(transaction, record, true);
      for (const record of snapshot.records) {
        if (record.projectId) {
          await transaction.execute('UPDATE records SET project_id = ? WHERE id = ?', [
            record.projectId,
            record.id,
          ]);
        }
      }
      await writeSettings(transaction, snapshot.settings);
    });
  }

  async saveType(type: TypeDef): Promise<void> {
    const [{ next_order: order = 0 } = {}] = await this.executor.select<{ next_order: number }>(
      'SELECT COALESCE(MAX(sort_order) + 1, 0) AS next_order FROM types',
    );
    await writeType(this.executor, type, Number(order));
  }

  async deleteType(id: string): Promise<void> {
    await this.executor.execute('DELETE FROM types WHERE id = ?', [id]);
  }

  async saveWorkspace(workspace: Workspace): Promise<void> {
    const [{ next_order: order = 0 } = {}] = await this.executor.select<{ next_order: number }>(
      'SELECT COALESCE(MAX(sort_order) + 1, 0) AS next_order FROM workspaces',
    );
    await writeWorkspace(this.executor, workspace, Number(order));
  }

  async deleteWorkspace(id: string): Promise<void> {
    const fallback = this.buildInitialSnapshot().workspaces[0]?.id;
    if (!fallback || fallback === id) throw new Error('不能删除默认工作区');
    await this.executor.transaction(async (transaction) => {
      await transaction.execute('UPDATE records SET workspace_id = ? WHERE workspace_id = ?', [
        fallback,
        id,
      ]);
      await transaction.execute('DELETE FROM workspaces WHERE id = ?', [id]);
    });
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await writeSettings(this.executor, settings);
  }

  async saveDraft(draft: Draft): Promise<void> {
    await this.executor.execute(
      `INSERT INTO drafts (id, record_id, payload, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET record_id=excluded.record_id,
         payload=excluded.payload, updated_at=excluded.updated_at`,
      [draft.id, draft.recordId, draft.payload, draft.updatedAt],
    );
  }

  async loadDraft(id: string): Promise<Draft | null> {
    const [row] = await this.executor.select<DraftRow>('SELECT * FROM drafts WHERE id = ?', [id]);
    return row
      ? { id: row.id, recordId: row.record_id, payload: row.payload, updatedAt: row.updated_at }
      : null;
  }

  async deleteDraft(id: string): Promise<void> {
    await this.executor.execute('DELETE FROM drafts WHERE id = ?', [id]);
  }
}
