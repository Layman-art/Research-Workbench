import { describe, expect, it } from 'vitest';
import { BUILTIN_TYPES, BUILTIN_WORKSPACES, buildSampleRecords } from '../sample';
import type { WorkbenchRepository } from '../repositories/WorkbenchRepository';
import { InMemoryWorkbenchRepository } from '../repositories/InMemoryWorkbenchRepository';
import type { WorkbenchSnapshot } from '../domain/models';

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

function repositoryContract(factory: () => Promise<WorkbenchRepository>) {
  it('persists and deletes a record without leaking mutable references', async () => {
    const repository = await factory();
    await repository.initialize();
    const initial = await repository.loadSnapshot();
    const record = {
      ...initial.records[0],
      id: 'contract-record',
      title: '事务测试',
      fields: initial.records[0].fields.map((field) => ({ ...field })),
    };

    await repository.saveRecord(record);
    record.title = '外部修改不应污染仓储';

    expect((await repository.loadSnapshot()).records).toContainEqual({
      ...record,
      title: '事务测试',
    });

    await repository.deleteRecord(record.id);
    expect((await repository.loadSnapshot()).records.some((item) => item.id === record.id)).toBe(
      false,
    );
  });
}

describe('InMemoryWorkbenchRepository contract', () => {
  repositoryContract(async () => new InMemoryWorkbenchRepository(initialSnapshot()));
});
