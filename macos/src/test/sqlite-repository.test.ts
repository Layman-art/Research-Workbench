import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { BUILTIN_TYPES, BUILTIN_WORKSPACES, buildSampleRecords } from '../sample';
import type { WorkbenchSnapshot } from '../domain/models';
import {
  SqliteWorkbenchRepository,
  type SqlExecutor,
  type SqlResult,
} from '../repositories/SqliteWorkbenchRepository';

const initialSnapshot = (): WorkbenchSnapshot => ({
  records: buildSampleRecords(),
  types: BUILTIN_TYPES,
  workspaces: BUILTIN_WORKSPACES,
  settings: {
    displayName: '',
    theme: 'system',
    motion: 'system',
    projectViewMode: 'list',
    closeToTray: true,
    autoLaunch: false,
    notificationsEnabled: true,
  },
});

class NodeSqliteExecutor implements SqlExecutor {
  readonly database = new DatabaseSync(':memory:');
  failWhenSqlIncludes: string | null = null;
  forbidSelectInsideTransaction = false;
  private insideTransaction = false;

  async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (this.forbidSelectInsideTransaction && this.insideTransaction) {
      throw new Error('事务准备阶段不支持查询');
    }
    return this.database.prepare(sql).all(...(params as SQLInputValue[])) as T[];
  }

  async execute(sql: string, params: unknown[] = []): Promise<SqlResult> {
    if (this.failWhenSqlIncludes && sql.includes(this.failWhenSqlIncludes)) {
      throw new Error('injected write failure');
    }
    const result = this.database.prepare(sql).run(...(params as SQLInputValue[]));
    return { rowsAffected: Number(result.changes), lastInsertId: Number(result.lastInsertRowid) };
  }

  async transaction<T>(work: (transaction: SqlExecutor) => Promise<T>): Promise<T> {
    this.database.exec('BEGIN IMMEDIATE');
    this.insideTransaction = true;
    try {
      const result = await work(this);
      this.database.exec('COMMIT');
      return result;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    } finally {
      this.insideTransaction = false;
    }
  }
}

describe('SqliteWorkbenchRepository', () => {
  it('initializes schema and round-trips a complete record', async () => {
    const executor = new NodeSqliteExecutor();
    const repository = new SqliteWorkbenchRepository(executor, initialSnapshot);
    await repository.initialize();
    const project = (await repository.loadSnapshot()).records.find(
      (record) => record.typeId === 'project',
    )!;
    const record = {
      ...project,
      id: 'sqlite-roundtrip',
      typeId: 'todo',
      title: '关联项目的周期行动',
      projectId: project.id,
      recurrence: { frequency: 'weekly' as const, interval: 2 },
      literature: {
        authors: 'Grace Hopper',
        year: 2026,
        doi: '10.1000/sqlite',
        url: 'https://doi.org/10.1000/sqlite',
        readingStatus: 'reading' as const,
      },
      fields: [{ id: 'sql-field', name: '命令', value: 'pnpm test' }],
    };

    await repository.saveRecord(record);

    expect((await repository.loadSnapshot()).records).toContainEqual(record);
  });

  it('rolls back the record upsert when a dependent field write fails', async () => {
    const executor = new NodeSqliteExecutor();
    const repository = new SqliteWorkbenchRepository(executor, initialSnapshot);
    await repository.initialize();
    const original = (await repository.loadSnapshot()).records[0];
    executor.failWhenSqlIncludes = 'INSERT INTO record_fields';

    await expect(
      repository.saveRecord({
        ...original,
        title: '不应被部分写入',
        fields: [{ id: 'will-fail', name: '失败', value: '回滚' }],
      }),
    ).rejects.toThrow('injected write failure');

    expect((await repository.loadSnapshot()).records.find((record) => record.id === original.id))
      .toEqual(original);
  });

  it('sets linked next actions projectId to null when a project is deleted', async () => {
    const executor = new NodeSqliteExecutor();
    const repository = new SqliteWorkbenchRepository(executor, initialSnapshot);
    await repository.initialize();
    const project = (await repository.loadSnapshot()).records.find(
      (record) => record.typeId === 'project',
    )!;
    const action = {
      ...project,
      id: 'linked-action',
      typeId: 'todo',
      title: '下一步行动',
      projectId: project.id,
    };
    await repository.saveRecord(action);

    await repository.deleteRecord(project.id);

    expect(
      (await repository.loadSnapshot()).records.find((record) => record.id === action.id)?.projectId,
    ).toBeNull();
  });

  it('completes a recurring todo and creates its next occurrence atomically', async () => {
    const executor = new NodeSqliteExecutor();
    const repository = new SqliteWorkbenchRepository(executor, initialSnapshot);
    await repository.initialize();
    const original = (await repository.loadSnapshot()).records.find(
      (record) => record.typeId === 'todo' && !record.done,
    )!;
    const recurring = {
      ...original,
      dueDate: '2026-08-17',
      recurrence: { frequency: 'weekly' as const, interval: 1 },
      fields: [{ id: 'recurrence-note', name: '场景', value: '组会' }],
    };
    await repository.saveRecord(recurring);
    const completedAt = new Date(2026, 7, 17, 12).getTime();

    const result = await repository.completeTodo(recurring.id, completedAt);

    expect(result.completed.done).toBe(true);
    expect(result.next).toMatchObject({ done: false, dueDate: '2026-08-24', recurrence: recurring.recurrence });
    const stored = await repository.loadSnapshot();
    expect(stored.records.find((record) => record.id === recurring.id)?.done).toBe(true);
    expect(stored.records.find((record) => record.id === result.next?.id)?.dueDate).toBe('2026-08-24');
  });

  it('completes a todo when the desktop transaction adapter forbids reads', async () => {
    const executor = new NodeSqliteExecutor();
    const repository = new SqliteWorkbenchRepository(executor, initialSnapshot);
    await repository.initialize();
    const todo = (await repository.loadSnapshot()).records.find(
      (record) => record.typeId === 'todo' && !record.done,
    )!;
    executor.forbidSelectInsideTransaction = true;

    const result = await repository.completeTodo(todo.id, Date.now());

    expect(result.completed.done).toBe(true);
    expect((await repository.loadSnapshot()).records.find((record) => record.id === todo.id)?.done)
      .toBe(true);
  });

  it('rolls back recurring completion if creating the next occurrence fails', async () => {
    const executor = new NodeSqliteExecutor();
    const repository = new SqliteWorkbenchRepository(executor, initialSnapshot);
    await repository.initialize();
    const original = (await repository.loadSnapshot()).records.find(
      (record) => record.typeId === 'todo' && !record.done,
    )!;
    const recurring = {
      ...original,
      dueDate: '2026-08-17',
      recurrence: { frequency: 'daily' as const, interval: 1 },
      fields: [{ id: 'rollback-field', name: '验证', value: '事务' }],
    };
    await repository.saveRecord(recurring);
    const beforeCount = (await repository.loadSnapshot()).records.length;
    executor.failWhenSqlIncludes = 'INSERT INTO record_fields';

    await expect(repository.completeTodo(recurring.id, new Date(2026, 7, 17, 12).getTime()))
      .rejects.toThrow('injected write failure');

    const stored = await repository.loadSnapshot();
    expect(stored.records).toHaveLength(beforeCount);
    expect(stored.records.find((record) => record.id === recurring.id)?.done).toBe(false);
  });

  it('updates and deletes batches atomically', async () => {
    const executor = new NodeSqliteExecutor();
    const repository = new SqliteWorkbenchRepository(executor, initialSnapshot);
    await repository.initialize();
    const originals = (await repository.loadSnapshot()).records.slice(0, 2);
    await repository.updateRecords(originals.map((record) => record.id), { archived: true });
    expect((await repository.loadSnapshot()).records.filter((record) => originals.some((item) => item.id === record.id)).every((record) => record.archived)).toBe(true);

    await expect(repository.updateRecords([originals[0].id, 'missing-id'], { archived: false }))
      .rejects.toThrow('部分记录不存在');
    expect((await repository.loadSnapshot()).records.find((record) => record.id === originals[0].id)?.archived).toBe(true);

    await repository.deleteRecords(originals.map((record) => record.id));
    expect((await repository.loadSnapshot()).records.some((record) => originals.some((item) => item.id === record.id))).toBe(false);
  });

  it('deduplicates reminder delivery reservations across repository restarts', async () => {
    const executor = new NodeSqliteExecutor();
    const repository = new SqliteWorkbenchRepository(executor, initialSnapshot);
    await repository.initialize();
    const todo = (await repository.loadSnapshot()).records.find((record) => record.typeId === 'todo')!;
    expect(await repository.reserveReminder(todo.id, '2026-08-17:due', Date.now())).toBe(true);
    const restarted = new SqliteWorkbenchRepository(executor, initialSnapshot);
    await restarted.initialize();
    expect(await restarted.reserveReminder(todo.id, '2026-08-17:due', Date.now())).toBe(false);
  });
});
