import type {
  AppSettings,
  ActivityEvent,
  Draft,
  RecordItem,
  TypeDef,
  WorkbenchSnapshot,
  Workspace,
} from '../domain/models';

export type BatchRecordPatch = Pick<Partial<RecordItem>, 'archived' | 'workspaceId' | 'projectId' | 'status' | 'deletedAt'>;

export interface WorkbenchRepository {
  initialize(): Promise<void>;
  loadActivities(since?: number): Promise<ActivityEvent[]>;
  restoreRecords(ids: string[]): Promise<void>;
  permanentlyDeleteRecords(ids: string[]): Promise<void>;
  purgeExpiredTrash(now?: number): Promise<void>;
  reorderTypes(ids: string[]): Promise<void>;
  reorderRecords(orders: Array<{ id: string; order: number }>): Promise<void>;
  listDrafts(): Promise<Draft[]>;
  loadSnapshot(): Promise<WorkbenchSnapshot>;
  saveRecord(record: RecordItem): Promise<void>;
  deleteRecord(id: string): Promise<void>;
  completeTodo(id: string, completedAt: number): Promise<{ completed: RecordItem; next: RecordItem | null }>;
  updateRecords(ids: string[], patch: BatchRecordPatch): Promise<RecordItem[]>;
  deleteRecords(ids: string[]): Promise<void>;
  reserveReminder(recordId: string, occurrenceKey: string, deliveredAt: number): Promise<boolean>;
  replaceAll(snapshot: WorkbenchSnapshot): Promise<void>;
  saveType(type: TypeDef): Promise<void>;
  deleteType(id: string): Promise<void>;
  saveWorkspace(workspace: Workspace): Promise<void>;
  deleteWorkspace(id: string): Promise<void>;
  saveSettings(settings: AppSettings): Promise<void>;
  saveDraft(draft: Draft): Promise<void>;
  loadDraft(id: string): Promise<Draft | null>;
  deleteDraft(id: string): Promise<void>;
}
