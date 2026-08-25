import type {
  AppSettings,
  Draft,
  RecordItem,
  TypeDef,
  WorkbenchSnapshot,
  Workspace,
} from '../domain/models';
import type { BatchRecordPatch, WorkbenchRepository } from './WorkbenchRepository';
import { completeTodoRecords } from '../features/todos/completeTodo';

const clone = <T>(value: T): T => structuredClone(value);

export class InMemoryWorkbenchRepository implements WorkbenchRepository {
  private snapshot: WorkbenchSnapshot;
  private readonly drafts = new Map<string, Draft>();
  private readonly reminderDeliveries = new Set<string>();

  constructor(initial: WorkbenchSnapshot) {
    this.snapshot = clone(initial);
  }

  async initialize(): Promise<void> {}

  async loadSnapshot(): Promise<WorkbenchSnapshot> {
    return clone(this.snapshot);
  }

  async saveRecord(record: RecordItem): Promise<void> {
    const index = this.snapshot.records.findIndex((item) => item.id === record.id);
    if (index < 0) this.snapshot.records.push(clone(record));
    else this.snapshot.records[index] = clone(record);
  }

  async deleteRecord(id: string): Promise<void> {
    this.snapshot.records = this.snapshot.records
      .filter((record) => record.id !== id)
      .map((record) => (record.projectId === id ? { ...record, projectId: null } : record));
  }

  async completeTodo(id: string, completedAt: number) {
    const record = this.snapshot.records.find((item) => item.id === id);
    if (!record) throw new Error('待办不存在');
    const result = completeTodoRecords(record, completedAt, crypto.randomUUID());
    this.snapshot.records = this.snapshot.records.map((item) =>
      item.id === id ? clone(result.completed) : item,
    );
    if (result.next) this.snapshot.records.unshift(clone(result.next));
    return clone(result);
  }

  async updateRecords(ids: string[], patch: BatchRecordPatch): Promise<RecordItem[]> {
    const wanted = new Set(ids);
    const records = this.snapshot.records.filter((record) => wanted.has(record.id));
    if (records.length !== wanted.size) throw new Error('部分记录不存在');
    if (patch.workspaceId && !this.snapshot.workspaces.some((workspace) => workspace.id === patch.workspaceId)) {
      throw new Error('目标工作区不存在');
    }
    const updatedAt = Date.now();
    const updated = records.map((record) => ({ ...record, ...patch, updatedAt }));
    const byId = new Map(updated.map((record) => [record.id, record]));
    this.snapshot.records = this.snapshot.records.map((record) => clone(byId.get(record.id) ?? record));
    return clone(updated);
  }

  async deleteRecords(ids: string[]): Promise<void> {
    const wanted = new Set(ids);
    if (this.snapshot.records.filter((record) => wanted.has(record.id)).length !== wanted.size) {
      throw new Error('部分记录不存在');
    }
    this.snapshot.records = this.snapshot.records
      .filter((record) => !wanted.has(record.id))
      .map((record) => record.projectId && wanted.has(record.projectId) ? { ...record, projectId: null } : record);
  }

  async reserveReminder(recordId: string, occurrenceKey: string): Promise<boolean> {
    const key = `${recordId}:${occurrenceKey}`;
    if (this.reminderDeliveries.has(key)) return false;
    this.reminderDeliveries.add(key);
    return true;
  }

  async replaceAll(snapshot: WorkbenchSnapshot): Promise<void> {
    this.snapshot = clone(snapshot);
  }

  async saveType(type: TypeDef): Promise<void> {
    const index = this.snapshot.types.findIndex((item) => item.id === type.id);
    if (index < 0) this.snapshot.types.push(clone(type));
    else this.snapshot.types[index] = clone(type);
  }

  async deleteType(id: string): Promise<void> {
    this.snapshot.types = this.snapshot.types.filter((type) => type.id !== id);
    this.snapshot.records = this.snapshot.records.filter((record) => record.typeId !== id);
  }

  async saveWorkspace(workspace: Workspace): Promise<void> {
    const index = this.snapshot.workspaces.findIndex((item) => item.id === workspace.id);
    if (index < 0) this.snapshot.workspaces.push(clone(workspace));
    else this.snapshot.workspaces[index] = clone(workspace);
  }

  async deleteWorkspace(id: string): Promise<void> {
    this.snapshot.workspaces = this.snapshot.workspaces.filter((workspace) => workspace.id !== id);
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    this.snapshot.settings = clone(settings);
  }

  async saveDraft(draft: Draft): Promise<void> {
    this.drafts.set(draft.id, clone(draft));
  }

  async loadDraft(id: string): Promise<Draft | null> {
    const draft = this.drafts.get(id);
    return draft ? clone(draft) : null;
  }

  async deleteDraft(id: string): Promise<void> {
    this.drafts.delete(id);
  }
}
