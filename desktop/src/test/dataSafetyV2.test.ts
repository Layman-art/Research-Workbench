import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildInitialSnapshot } from '../repositories';
import { InMemoryWorkbenchRepository } from '../repositories/InMemoryWorkbenchRepository';
import { SqliteWorkbenchRepository, recordToRow, type SqlExecutor } from '../repositories/SqliteWorkbenchRepository';
import { SCHEMA_V1 } from '../repositories/schema';
import { createWorkbenchStore, validateImportData } from '../stores/workbenchStore';

class Executor implements SqlExecutor {
  database: DatabaseSync;
  constructor(path = ':memory:') { this.database = new DatabaseSync(path); }
  async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.database.prepare(sql).all(...params as SQLInputValue[]) as T[];
  }
  async execute(sql: string, params: unknown[] = []) {
    return { rowsAffected: Number(this.database.prepare(sql).run(...params as SQLInputValue[]).changes) };
  }
  async transaction<T>(work: (transaction: SqlExecutor) => Promise<T>): Promise<T> {
    this.database.exec('BEGIN IMMEDIATE');
    try { const result = await work(this); this.database.exec('COMMIT'); return result; }
    catch (error) { this.database.exec('ROLLBACK'); throw error; }
  }
}

describe('v2 data safety', () => {
  it('serializes concurrent updates without overwriting a previous field', async () => {
    const repository = new InMemoryWorkbenchRepository(buildInitialSnapshot());
    const store = createWorkbenchStore(repository);
    await store.getState().hydrate();
    const record = store.getState().records.find((item) => item.typeId === 'note')!;
    await Promise.all([
      store.getState().updateRecord(record.id, { title: '新标题' }),
      store.getState().updateRecord(record.id, { content: '新正文' }),
    ]);
    expect((await repository.loadSnapshot()).records.find((item) => item.id === record.id)).toMatchObject({ title: '新标题', content: '新正文' });
    expect(store.getState().activities.filter((event) => event.recordId === record.id)).toHaveLength(2);
  });

  it('keeps retries idempotent and lets the queue continue after a write failure', async () => {
    const repository = new InMemoryWorkbenchRepository(buildInitialSnapshot());
    const store = createWorkbenchStore(repository);
    await store.getState().hydrate();
    const save = repository.saveRecord.bind(repository);
    repository.saveRecord = async () => { throw new Error('disk full'); };
    await expect(store.getState().addRecord({ id: 'stable-draft', typeId: 'note', title: '长文' })).rejects.toThrow('disk full');
    expect(store.getState().records.some((item) => item.id === 'stable-draft')).toBe(false);
    repository.saveRecord = save;
    await Promise.all([
      store.getState().addRecord({ id: 'stable-draft', typeId: 'note', title: '长文' }),
      store.getState().addRecord({ id: 'stable-draft', typeId: 'note', title: '长文' }),
    ]);
    expect(store.getState().records.filter((item) => item.id === 'stable-draft')).toHaveLength(1);
  });

  it('clears only completed records in the current workspace and restores them', async () => {
    const repository = new InMemoryWorkbenchRepository(buildInitialSnapshot());
    const store = createWorkbenchStore(repository);
    await store.getState().hydrate();
    await store.getState().addWorkspace('工作区 B');
    const [a, b] = store.getState().workspaces;
    const first = await store.getState().addRecord({ typeId: 'todo', title: 'A', workspaceId: a.id, done: true });
    const second = await store.getState().addRecord({ typeId: 'todo', title: 'B', workspaceId: b.id, done: true });
    store.getState().setWorkspaceFilter(b.id);
    await store.getState().clearDone('todo');
    expect(store.getState().records.find((item) => item.id === first.id)?.deletedAt).toBeUndefined();
    expect(store.getState().records.find((item) => item.id === second.id)?.deletedAt).toBeTypeOf('number');
    await store.getState().restoreRecords([second.id]);
    expect(store.getState().records.find((item) => item.id === second.id)?.deletedAt).toBeUndefined();
    expect(store.getState().activities.some((event) => event.kind === 'restored' && event.recordId === second.id)).toBe(true);
  });

  it('normalizes old schedule fields and supports an export/import round-trip', async () => {
    const initial = buildInitialSnapshot();
    const legacy = { app: 'research-workbench', version: 1, ...initial,
      records: initial.records.map((record) => { const item = { ...record } as Record<string, unknown>; delete item.planDate; delete item.planStart; delete item.planEnd; return item; }) };
    const preview = validateImportData(legacy);
    expect(preview.ok).toBe(true);
    if (!preview.ok) throw new Error(preview.error);
    expect(preview.snapshot.records.every((record) => record.planDate === null)).toBe(true);
    const store = createWorkbenchStore(new InMemoryWorkbenchRepository(initial));
    await store.getState().hydrate();
    await store.getState().importData(legacy);
    expect(validateImportData(JSON.parse(JSON.stringify(store.getState().exportData()))).ok).toBe(true);
    expect(validateImportData({ ...legacy, version: 999 }).ok).toBe(false);
  });

  it.each(['memory', 'sqlite'])('protects incoming project links atomically in %s', async (backend) => {
    const executor = backend === 'sqlite' ? new Executor() : null;
    const repository = executor ? new SqliteWorkbenchRepository(executor, buildInitialSnapshot) : new InMemoryWorkbenchRepository(buildInitialSnapshot());
    try {
      const store = createWorkbenchStore(repository);
      await store.getState().hydrate();
      await store.getState().addWorkspace('目标工作区');
      const [a, b] = store.getState().workspaces;
      const project = await store.getState().addRecord({ typeId: 'project', title: '关联项目', workspaceId: a.id });
      const note = await store.getState().addRecord({ typeId: 'note', title: '关联笔记', content: '正文不可改变', workspaceId: a.id, projectId: project.id });
      const unrelated = await store.getState().addRecord({ typeId: 'note', title: '批量同行', workspaceId: a.id });
      const before = await repository.loadSnapshot();
      await expect(store.getState().updateRecord(project.id, { workspaceId: b.id })).rejects.toThrow('先解除关联');
      await expect(store.getState().updateRecord(project.id, { typeId: 'note' })).rejects.toThrow('先解除关联');
      await expect(store.getState().updateRecords([unrelated.id, project.id], { workspaceId: b.id })).rejects.toThrow('先解除关联');
      expect(await repository.loadSnapshot()).toEqual(before);
      expect(store.getState().records.find((item) => item.id === note.id)).toMatchObject({ content: '正文不可改变', projectId: project.id });
      const exported = JSON.parse(JSON.stringify(store.getState().exportData()));
      expect(validateImportData(exported).ok).toBe(true);
      await store.getState().importData(exported);
      await store.getState().deleteRecord(note.id);
      await expect(store.getState().updateRecord(project.id, { workspaceId: b.id })).rejects.toThrow('含回收站');
      await store.getState().updateRecord(note.id, { projectId: null });
      await store.getState().updateRecord(project.id, { workspaceId: b.id });
      expect(validateImportData(store.getState().exportData()).ok).toBe(true);
      expect((await repository.loadSnapshot()).records.find((item) => item.id === project.id)?.workspaceId).toBe(b.id);
    } finally { executor?.database.close(); }
  });

  it.each([1, 2, 3])('preserves legacy invalid schedule times through version %s imports and exports', async (version) => {
    const initial = buildInitialSnapshot();
    const record = { ...initial.records[0], planStart: '18:00', planEnd: '09:00' };
    const payload = { app: 'research-workbench', version, ...initial, records: [record] };
    const preview = validateImportData(payload);
    expect(preview.ok).toBe(true);
    if (!preview.ok) throw new Error(preview.error);
    expect(preview.warnings.join('')).toContain('原样保留');
    const store = createWorkbenchStore(new InMemoryWorkbenchRepository(initial));
    await store.getState().hydrate();
    await store.getState().importData(payload);
    const exported = store.getState().exportData();
    expect(exported.records[0]).toMatchObject({ planStart: '18:00', planEnd: '09:00' });
    expect(validateImportData(exported).ok).toBe(true);
    await expect(store.getState().updateRecord(record.id, { title: '仍须修正时间' })).rejects.toThrow('结束时间');
  });

  it('migrates a v1 database without seeding over existing content', async () => {
    const executor = new Executor();
    for (const statement of SCHEMA_V1) await executor.execute(statement);
    await executor.execute('INSERT INTO schema_migrations VALUES (1, 0)');
    const initial = buildInitialSnapshot();
    const type = initial.types.find((item) => item.id === 'note')!;
    const workspace = initial.workspaces[0];
    await executor.execute('INSERT INTO types VALUES (?, ?, ?, ?, ?, ?, ?)', [type.id, type.name, type.kind, type.icon, type.note, 1, 0]);
    await executor.execute('INSERT INTO workspaces VALUES (?, ?, ?, ?)', [workspace.id, workspace.name, 1, 0]);
    await executor.execute('INSERT INTO settings VALUES (?, ?)', ['app', JSON.stringify(initial.settings)]);
    const source = { ...initial.records.find((item) => item.typeId === 'note')!, id: 'legacy-user-note', content: '必须原样保留的正文' };
    const row = recordToRow(source);
    const entries = Object.entries(row).filter(([key]) => !['fields_json', 'literature_json', 'deleted_at', 'attachments_json'].includes(key));
    await executor.execute(`INSERT INTO records (${entries.map(([key]) => key).join(',')}) VALUES (${entries.map(() => '?').join(',')})`, entries.map(([, value]) => value));
    const repository = new SqliteWorkbenchRepository(executor, buildInitialSnapshot);
    await repository.initialize();
    expect((await repository.loadSnapshot()).records).toHaveLength(1);
    expect((await repository.loadSnapshot()).records[0].content).toBe(source.content);
    expect((await executor.select<{ version: number }>('SELECT MAX(version) AS version FROM schema_migrations'))[0].version).toBe(2);
    executor.database.close();
  });

  it('refuses future and incomplete databases without overwriting them', async () => {
    const executor = new Executor();
    const repository = new SqliteWorkbenchRepository(executor, buildInitialSnapshot);
    await repository.initialize();
    const before = (await repository.loadSnapshot()).records;
    await executor.execute('INSERT INTO schema_migrations VALUES (99, 0)');
    await expect(repository.initialize()).rejects.toThrow('较新版本');
    expect((await repository.loadSnapshot()).records).toEqual(before);
    await executor.execute('DELETE FROM schema_migrations WHERE version = 99');
    await executor.execute('DELETE FROM records');
    await executor.execute('DELETE FROM types');
    await expect(repository.initialize()).rejects.toThrow('内容不完整');
    expect(await executor.select('SELECT * FROM records')).toEqual([]);
    executor.database.close();
  });

  it('persists drafts, file references and trash across a real database reopen; sorting preserves reminder deduplication', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rw-v2-test-'));
    const path = join(dir, 'test.sqlite');
    let executor = new Executor(path);
    try {
      let repository = new SqliteWorkbenchRepository(executor, buildInitialSnapshot);
      await repository.initialize();
      const record = (await repository.loadSnapshot()).records[0];
      record.attachments = [{ id: 'ref', name: '实验结果', path: 'C:\\研究资料\\结果.csv', kind: 'file' }];
      await repository.saveRecord(record);
      await repository.saveDraft({ id: 'new:unsaved', recordId: null, payload: '{"content":"未完成正文"}', updatedAt: 1 });
      await repository.reserveReminder(record.id, 'test-day', Date.now());
      await repository.reorderTypes((await repository.loadSnapshot()).types.map((type) => type.id).reverse());
      await repository.reorderRecords([{ id: record.id, order: 42 }]);
      expect(await repository.reserveReminder(record.id, 'test-day', Date.now())).toBe(false);
      await repository.deleteRecord(record.id);
      executor.database.close();
      executor = new Executor(path);
      repository = new SqliteWorkbenchRepository(executor, buildInitialSnapshot);
      await repository.initialize();
      expect((await repository.loadSnapshot()).records.find((item) => item.id === record.id)).toMatchObject({ attachments: record.attachments, deletedAt: expect.any(Number) });
      expect(await repository.listDrafts()).toContainEqual({ id: 'new:unsaved', recordId: null, payload: '{"content":"未完成正文"}', updatedAt: 1 });
      await repository.restoreRecords([record.id]);
      expect((await repository.loadSnapshot()).records.find((item) => item.id === record.id)?.deletedAt).toBeUndefined();
      await repository.deleteRecord(record.id);
      await repository.purgeExpiredTrash(Date.now() + 31 * 86_400_000);
      expect((await repository.loadSnapshot()).records.some((item) => item.id === record.id)).toBe(false);
    } finally { executor.database.close(); rmSync(dir, { recursive: true }); }
  });
});
