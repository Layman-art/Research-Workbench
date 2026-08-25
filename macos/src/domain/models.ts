export type Status = 'planned' | 'active' | 'paused' | 'done';
export type Priority = 'none' | 'low' | 'medium' | 'high';
export type TypeKind = 'generic' | 'todo' | 'schedule' | 'direction' | 'project';
export type ThemeMode = 'system' | 'light' | 'dark';
export type MotionMode = 'system' | 'reduce' | 'full';
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';
export type ReadingStatus = 'unread' | 'reading' | 'read';

export interface CustomField {
  id: string;
  name: string;
  value: string;
}

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
}

export interface LiteratureDetails {
  authors: string;
  year: number | null;
  doi: string;
  url: string;
  readingStatus: ReadingStatus;
}

export interface RecordItem {
  id: string;
  typeId: string;
  workspaceId: string;
  title: string;
  content: string;
  status: Status;
  starred: boolean;
  archived: boolean;
  fields: CustomField[];
  priority: Priority;
  dueDate: string | null;
  done: boolean;
  planDate: string | null;
  planStart: string | null;
  planEnd: string | null;
  sub?: 'vertical' | 'horizontal' | null;
  projectId: string | null;
  recurrence: RecurrenceRule | null;
  literature: LiteratureDetails | null;
  createdAt: number;
  updatedAt: number;
  order?: number;
}

export interface TypeDef {
  id: string;
  name: string;
  kind: TypeKind;
  icon: string;
  note: string;
  builtin: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  builtin: boolean;
}

export interface AppSettings {
  displayName: string;
  theme: ThemeMode;
  motion: MotionMode;
  projectViewMode: 'list' | 'board';
  closeToTray: boolean;
  autoLaunch: boolean;
  notificationsEnabled: boolean;
}

export interface Draft {
  id: string;
  recordId: string | null;
  payload: string;
  updatedAt: number;
}

export interface WorkbenchSnapshot {
  records: RecordItem[];
  types: TypeDef[];
  workspaces: Workspace[];
  settings: AppSettings;
}

export interface ExportPayload {
  app: 'research-workbench';
  version: 1;
  exportedAt: string;
  records: RecordItem[];
  types: TypeDef[];
  workspaces: Workspace[];
}
