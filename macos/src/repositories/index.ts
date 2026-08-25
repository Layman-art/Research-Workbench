import { isTauri } from '@tauri-apps/api/core';
import type { WorkbenchSnapshot } from '../domain/models';
import { BUILTIN_TYPES, BUILTIN_WORKSPACES, buildSampleRecords } from '../sample';
import { InMemoryWorkbenchRepository } from './InMemoryWorkbenchRepository';
import { SqliteWorkbenchRepository } from './SqliteWorkbenchRepository';
import { createTauriSqlExecutor } from './tauriSqlExecutor';
import type { WorkbenchRepository } from './WorkbenchRepository';

export function buildInitialSnapshot(): WorkbenchSnapshot {
  return {
    records: buildSampleRecords(),
    types: BUILTIN_TYPES.map((type) => ({ ...type })),
    workspaces: BUILTIN_WORKSPACES.map((workspace) => ({ ...workspace })),
    settings: {
      displayName: '',
      theme: 'system',
      motion: 'system',
      projectViewMode: 'list',
      closeToTray: true,
      autoLaunch: false,
      notificationsEnabled: false,
    },
  };
}

async function createRepository(): Promise<WorkbenchRepository> {
  if (!isTauri()) return new InMemoryWorkbenchRepository(buildInitialSnapshot());
  const executor = await createTauriSqlExecutor();
  return new SqliteWorkbenchRepository(executor, buildInitialSnapshot);
}

class LazyWorkbenchRepository implements WorkbenchRepository {
  constructor(private readonly repository: Promise<WorkbenchRepository>) {}

  private async get() {
    return this.repository;
  }

  async initialize() { return (await this.get()).initialize(); }
  async loadSnapshot() { return (await this.get()).loadSnapshot(); }
  async saveRecord(record: Parameters<WorkbenchRepository['saveRecord']>[0]) { return (await this.get()).saveRecord(record); }
  async deleteRecord(id: string) { return (await this.get()).deleteRecord(id); }
  async completeTodo(id: string, completedAt: number) { return (await this.get()).completeTodo(id, completedAt); }
  async updateRecords(ids: string[], patch: Parameters<WorkbenchRepository['updateRecords']>[1]) { return (await this.get()).updateRecords(ids, patch); }
  async deleteRecords(ids: string[]) { return (await this.get()).deleteRecords(ids); }
  async reserveReminder(recordId: string, occurrenceKey: string, deliveredAt: number) { return (await this.get()).reserveReminder(recordId, occurrenceKey, deliveredAt); }
  async replaceAll(snapshot: WorkbenchSnapshot) { return (await this.get()).replaceAll(snapshot); }
  async saveType(type: Parameters<WorkbenchRepository['saveType']>[0]) { return (await this.get()).saveType(type); }
  async deleteType(id: string) { return (await this.get()).deleteType(id); }
  async saveWorkspace(workspace: Parameters<WorkbenchRepository['saveWorkspace']>[0]) { return (await this.get()).saveWorkspace(workspace); }
  async deleteWorkspace(id: string) { return (await this.get()).deleteWorkspace(id); }
  async saveSettings(settings: Parameters<WorkbenchRepository['saveSettings']>[0]) { return (await this.get()).saveSettings(settings); }
  async saveDraft(draft: Parameters<WorkbenchRepository['saveDraft']>[0]) { return (await this.get()).saveDraft(draft); }
  async loadDraft(id: string) { return (await this.get()).loadDraft(id); }
  async deleteDraft(id: string) { return (await this.get()).deleteDraft(id); }
}

export const workbenchRepository: WorkbenchRepository = new LazyWorkbenchRepository(
  createRepository(),
);
