import type {
  AppSettings,
  Draft,
  RecordItem,
  TypeDef,
  WorkbenchSnapshot,
  Workspace,
} from '../domain/models';

export type BatchRecordPatch = Pick<Partial<RecordItem>, 'archived' | 'workspaceId' | 'projectId' | 'status'>;

export interface WorkbenchRepository {
  initialize(): Promise<void>;
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
