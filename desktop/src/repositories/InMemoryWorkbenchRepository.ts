import type {
  AppSettings,
  ActivityEvent,
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

  async initialize(): Promise<void> { await this.purgeExpiredTrash(); }

  private log(record: RecordItem, kind: ActivityEvent['kind'], occurredAt = Date.now()) {
    this.snapshot.activities = (this.snapshot.activities ?? []).filter((event) => event.occurredAt >= Date.now() - 366 * 86_400_000);
    this.snapshot.activities.unshift({ id: crypto.randomUUID(), recordId: record.id,
      recordTitle: record.title, typeId: record.typeId, workspaceId: record.workspaceId, kind, occurredAt });
  }

  async loadActivities(since = 0): Promise<ActivityEvent[]> {
    const cutoff = Math.max(since, Date.now() - 366 * 86_400_000);
    return clone((this.snapshot.activities ?? []).filter((event) => event.occurredAt >= cutoff).sort((a, b) => b.occurredAt - a.occurredAt));
  }

  async restoreRecords(ids: string[]): Promise<void> {
    for (const record of this.snapshot.records) if (ids.includes(record.id) && record.deletedAt) {
      delete record.deletedAt;
      this.log(record, 'restored');
    }
  }

  async permanentlyDeleteRecords(ids: string[]): Promise<void> {
    const removed = new Set(this.snapshot.records.filter((record) => ids.includes(record.id) && record.deletedAt).map((record) => record.id));
    this.snapshot.records = this.snapshot.records.filter((record) => !removed.has(record.id))
      .map((record) => record.projectId && removed.has(record.projectId) ? { ...record, projectId: null } : record);
    for (const [id, draft] of this.drafts) if (draft.recordId && removed.has(draft.recordId)) this.drafts.delete(id);
  }

  async purgeExpiredTrash(now = Date.now()): Promise<void> {
    await this.permanentlyDeleteRecords(this.snapshot.records.filter((record) => record.deletedAt && record.deletedAt <= now - 30 * 86_400_000).map((record) => record.id));
  }

  async reorderTypes(ids: string[]): Promise<void> {
    const byId = new Map(this.snapshot.types.map((type) => [type.id, type]));
    if (ids.length !== byId.size || ids.some((id) => !byId.has(id))) throw new Error('类型顺序不完整');
    this.snapshot.types = ids.map((id) => byId.get(id)!);
  }

  async reorderRecords(orders: Array<{ id: string; order: number }>): Promise<void> {
    const byId = new Map(orders.map((item) => [item.id, item.order]));
    this.snapshot.records = this.snapshot.records.map((record) => byId.has(record.id) ? { ...record, order: byId.get(record.id) } : record);
  }

  async listDrafts(): Promise<Draft[]> { return clone([...this.drafts.values()].sort((a, b) => b.updatedAt - a.updatedAt)); }

  async loadSnapshot(): Promise<WorkbenchSnapshot> {
    return clone(this.snapshot);
  }

  async saveRecord(record: RecordItem): Promise<void> {
    const index = this.snapshot.records.findIndex((item) => item.id === record.id);
    if (index < 0) this.snapshot.records.push(clone(record));
    else this.snapshot.records[index] = clone(record);
    this.log(record, index < 0 ? 'created' : 'updated', record.updatedAt);
  }

  async deleteRecord(id: string): Promise<void> { await this.deleteRecords([id]); }

  async completeTodo(id: string, completedAt: number) {
    const record = this.snapshot.records.find((item) => item.id === id);
    if (!record || record.deletedAt) throw new Error('待办不存在');
    if (record.done) return { completed: clone(record), next: null };
    const result = completeTodoRecords(record, completedAt, crypto.randomUUID());
    this.snapshot.records = this.snapshot.records.map((item) =>
      item.id === id ? clone(result.completed) : item,
    );
    this.log(result.completed, 'completed', completedAt);
    if (result.next) { this.snapshot.records.unshift(clone(result.next)); this.log(result.next, 'created', completedAt); }
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
    const updated = records.map((record) => ({ ...record, ...(patch.workspaceId && patch.workspaceId !== record.workspaceId && patch.projectId === undefined ? { projectId: null } : {}), ...patch, updatedAt }));
    const byId = new Map(updated.map((record) => [record.id, record]));
    this.snapshot.records = this.snapshot.records.map((record) => clone(byId.get(record.id) ?? record));
    for (const record of updated) this.log(record, 'updated', updatedAt);
    return clone(updated);
  }

  async deleteRecords(ids: string[]): Promise<void> {
    const wanted = new Set(ids);
    if (this.snapshot.records.filter((record) => wanted.has(record.id)).length !== wanted.size) {
      throw new Error('部分记录不存在');
    }
    const now = Date.now();
    for (const record of this.snapshot.records) if (wanted.has(record.id) && !record.deletedAt) {
      record.deletedAt = now;
      this.log(record, 'deleted', now);
    }
  }

  async reserveReminder(recordId: string, occurrenceKey: string): Promise<boolean> {
    const key = `${recordId}:${occurrenceKey}`;
    if (this.reminderDeliveries.has(key)) return false;
    this.reminderDeliveries.add(key);
    return true;
  }

  async replaceAll(snapshot: WorkbenchSnapshot): Promise<void> {
    this.snapshot = clone(snapshot);
    this.drafts.clear();
    this.reminderDeliveries.clear();
  }

  async saveType(type: TypeDef): Promise<void> {
    const index = this.snapshot.types.findIndex((item) => item.id === type.id);
    if (index < 0) this.snapshot.types.push(clone(type));
    else this.snapshot.types[index] = clone(type);
  }

  async deleteType(id: string): Promise<void> {
    if (this.snapshot.types.find((type) => type.id === id)?.builtin) throw new Error('内置类型不能删除');
    if (this.snapshot.records.some((record) => record.typeId === id)) throw new Error('此类型仍有记录（含回收站），请先迁移记录');
    this.snapshot.types = this.snapshot.types.filter((type) => type.id !== id);
    this.snapshot.records = this.snapshot.records.filter((record) => record.typeId !== id);
  }

  async saveWorkspace(workspace: Workspace): Promise<void> {
    const index = this.snapshot.workspaces.findIndex((item) => item.id === workspace.id);
    if (index < 0) this.snapshot.workspaces.push(clone(workspace));
    else this.snapshot.workspaces[index] = clone(workspace);
  }

  async deleteWorkspace(id: string): Promise<void> {
    const fallback = this.snapshot.workspaces.find((workspace) => workspace.id !== id)?.id;
    if (!fallback || this.snapshot.workspaces.find((workspace) => workspace.id === id)?.builtin) throw new Error('不能删除默认工作区');
    this.snapshot.records = this.snapshot.records.map((record) => record.workspaceId === id ? { ...record, workspaceId: fallback } : record);
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
