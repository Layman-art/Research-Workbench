import { describe, expect, it } from 'vitest';
import { buildSampleRecords, BUILTIN_TYPES, BUILTIN_WORKSPACES } from '../sample';
import { InMemoryWorkbenchRepository } from '../repositories/InMemoryWorkbenchRepository';
import { createWorkbenchStore } from '../stores/workbenchStore';
import type { WorkbenchSnapshot } from '../domain/models';

const snapshot = (): WorkbenchSnapshot => ({
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

describe('createWorkbenchStore', () => {
  it('hydrates the cache from its repository', async () => {
    const repository = new InMemoryWorkbenchRepository(snapshot());
    const store = createWorkbenchStore(repository);

    await store.getState().hydrate();

    expect(store.getState().phase).toBe('ready');
    expect(store.getState().records).toHaveLength(snapshot().records.length);
  });

  it('keeps the prior cache when a persistent update fails', async () => {
    const repository = new InMemoryWorkbenchRepository(snapshot());
    const store = createWorkbenchStore(repository);
    await store.getState().hydrate();
    const record = store.getState().records[0];
    repository.saveRecord = async () => {
      throw new Error('disk full');
    };

    await expect(
      store.getState().updateRecord(record.id, { title: '保留草稿' }),
    ).rejects.toThrow('disk full');

    expect(store.getState().records.find((item) => item.id === record.id)?.title).not.toBe(
      '保留草稿',
    );
    expect(store.getState().error).toContain('disk full');
  });

  it('persists record lifecycle actions before changing the cache', async () => {
    const repository = new InMemoryWorkbenchRepository(snapshot());
    const store = createWorkbenchStore(repository);
    await store.getState().hydrate();

    const record = await store.getState().addRecord({ typeId: 'todo', title: '事务待办' });
    await store.getState().toggleStar(record.id);
    await store.getState().toggleDone(record.id);
    expect((await repository.loadSnapshot()).records.find((item) => item.id === record.id)).toMatchObject({
      starred: true,
      done: true,
    });

    await store.getState().deleteRecord(record.id);
    expect((await repository.loadSnapshot()).records.some((item) => item.id === record.id)).toBe(
      false,
    );
  });

  it('persists type, workspace, and record reordering as one snapshot', async () => {
    const repository = new InMemoryWorkbenchRepository(snapshot());
    const store = createWorkbenchStore(repository);
    await store.getState().hydrate();

    await store.getState().reorderType('direction', 'project', false);
    const records = store.getState().records.filter((record) => record.typeId === 'note').slice(0, 2);
    await store.getState().reorderRecord(records[0].id, records[1].id, true);

    const persisted = await repository.loadSnapshot();
    expect(persisted.types[0].id).toBe('direction');
    expect(
      persisted.records.find((record) => record.id === records[0].id)?.order,
    ).toBeGreaterThan(
      persisted.records.find((record) => record.id === records[1].id)?.order ?? 0,
    );
  });

  it('rejects malformed imports without replacing persisted data', async () => {
    const repository = new InMemoryWorkbenchRepository(snapshot());
    const store = createWorkbenchStore(repository);
    await store.getState().hydrate();
    const before = await repository.loadSnapshot();

    const result = await store.getState().importData({ records: 'invalid' });

    expect(result.ok).toBe(false);
    expect((await repository.loadSnapshot()).records).toEqual(before.records);
  });

  it('persists desktop settings before exposing them to the UI', async () => {
    const repository = new InMemoryWorkbenchRepository(snapshot());
    const store = createWorkbenchStore(repository);
    await store.getState().hydrate();

    await store.getState().updateSettings({ closeToTray: false, autoLaunch: true });

    expect((await repository.loadSnapshot()).settings).toMatchObject({
      closeToTray: false,
      autoLaunch: true,
    });
    expect(store.getState().settings).toMatchObject({ closeToTray: false, autoLaunch: true });
  });

  it('clears visible completed todos but keeps active and archived records', async () => {
    const repository = new InMemoryWorkbenchRepository(snapshot());
    const store = createWorkbenchStore(repository);
    await store.getState().hydrate();
    const active = await store.getState().addRecord({ typeId: 'todo', title: '保留' });
    const done = await store.getState().addRecord({ typeId: 'todo', title: '清理' });
    const archived = await store.getState().addRecord({ typeId: 'todo', title: '归档保留' });
    await store.getState().toggleDone(done.id);
    await store.getState().toggleDone(archived.id);
    await store.getState().archiveRecord(archived.id, true);

    await store.getState().clearDone('todo');

    expect(store.getState().records.some((record) => record.id === active.id)).toBe(true);
    expect(store.getState().records.some((record) => record.id === done.id)).toBe(false);
    expect(store.getState().records.some((record) => record.id === archived.id)).toBe(true);
  });

  it('deleting a type removes its records from persistence', async () => {
    const repository = new InMemoryWorkbenchRepository(snapshot());
    const store = createWorkbenchStore(repository);
    await store.getState().hydrate();
    await store.getState().addType('专利');
    const type = store.getState().types.find((item) => item.name === '专利')!;
    await store.getState().addRecord({ typeId: type.id, title: '专利草稿' });

    await store.getState().deleteType(type.id);

    const persisted = await repository.loadSnapshot();
    expect(persisted.types.some((item) => item.id === type.id)).toBe(false);
    expect(persisted.records.some((record) => record.typeId === type.id)).toBe(false);
  });

  it('rejects unsafe icons and invalid schedule dates during import', async () => {
    const repository = new InMemoryWorkbenchRepository(snapshot());
    const store = createWorkbenchStore(repository);
    await store.getState().hydrate();
    const payload = store.getState().exportData();
    const schedule = payload.records.find((record) => record.typeId === 'schedule')!;

    const unsafeIcon = await store.getState().importData({
      ...payload,
      types: payload.types.map((type, index) =>
        index === 0 ? { ...type, icon: '__proto__' } : type,
      ),
    });
    const invalidDate = await store.getState().importData({
      ...payload,
      records: payload.records.map((record) =>
        record.id === schedule.id ? { ...record, planDate: '2026-02-30' } : record,
      ),
    });

    expect(unsafeIcon.ok).toBe(false);
    expect(invalidDate.ok).toBe(false);
  });
});
