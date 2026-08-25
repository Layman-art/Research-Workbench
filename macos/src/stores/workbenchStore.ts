import { create } from 'zustand';
import type {
  AppSettings,
  ExportPayload,
  RecordItem,
  TypeDef,
  WorkbenchSnapshot,
  Workspace,
} from '../domain/models';
import type { BatchRecordPatch, WorkbenchRepository } from '../repositories/WorkbenchRepository';
import { BUILTIN_TYPES, BUILTIN_WORKSPACES, buildSampleRecords } from '../sample';
import { pickNote } from '../types';
import { isTypeIcon } from '../icons';
import { orderKey } from '../planUtils';

export type StorePhase = 'loading' | 'ready' | 'error';
export type View = 'dashboard' | 'settings' | string;

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export interface WorkbenchState {
  phase: StorePhase;
  error: string | null;
  records: RecordItem[];
  types: TypeDef[];
  workspaces: Workspace[];
  settings: AppSettings | null;
  view: View;
  workspaceFilter: string;
  search: string;
  statusFilter: string;
  displayName: string;
  hydrate: () => Promise<void>;
  addRecord: (
    partial: Partial<RecordItem> & Pick<RecordItem, 'typeId' | 'title'>,
  ) => Promise<RecordItem>;
  updateRecord: (id: string, patch: Partial<RecordItem>) => Promise<void>;
  duplicateRecord: (id: string) => Promise<void>;
  archiveRecord: (id: string, archived: boolean) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  clearDone: (typeId: string) => Promise<void>;
  toggleStar: (id: string) => Promise<void>;
  toggleDone: (id: string) => Promise<void>;
  completeTodo: (id: string, completedAt?: number) => Promise<void>;
  updateRecords: (ids: string[], patch: BatchRecordPatch) => Promise<void>;
  deleteRecords: (ids: string[]) => Promise<void>;
  addType: (name: string, kind?: TypeDef['kind']) => Promise<void>;
  renameType: (id: string, name: string) => Promise<void>;
  deleteType: (id: string) => Promise<void>;
  reorderType: (id: string, targetId: string, after: boolean) => Promise<void>;
  reorderRecord: (id: string, targetId: string, after: boolean) => Promise<void>;
  addWorkspace: (name: string) => Promise<void>;
  renameWorkspace: (id: string, name: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  setView: (view: View) => void;
  setWorkspaceFilter: (id: string) => void;
  setSearch: (query: string) => void;
  setStatusFilter: (status: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  setDisplayName: (name: string) => Promise<void>;
  exportData: () => ExportPayload;
  importData: (payload: unknown) => Promise<{ ok: boolean; error?: string }>;
  resetSample: () => Promise<void>;
}

const STATUS_VALUES = new Set(['planned', 'active', 'paused', 'done']);
const PRIORITY_VALUES = new Set(['none', 'low', 'medium', 'high']);
const TYPE_KIND_VALUES = new Set(['generic', 'todo', 'schedule', 'direction', 'project']);
const RECURRENCE_VALUES = new Set(['daily', 'weekly', 'monthly']);
const READING_VALUES = new Set(['unread', 'reading', 'read']);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAppSettings(value: unknown): value is AppSettings {
  return (
    isObject(value) &&
    typeof value.displayName === 'string' &&
    ['system', 'light', 'dark'].includes(String(value.theme)) &&
    ['system', 'reduce', 'full'].includes(String(value.motion)) &&
    ['list', 'board'].includes(String(value.projectViewMode)) &&
    typeof value.closeToTray === 'boolean' &&
    typeof value.autoLaunch === 'boolean' &&
    typeof value.notificationsEnabled === 'boolean'
  );
}

function isNullableDate(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isNullableTime(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value));
}

function isRecord(value: unknown): value is RecordItem {
  if (!isObject(value)) return false;
  const recurrence = value.recurrence;
  const literature = value.literature;
  return (
    typeof value.id === 'string' &&
    typeof value.typeId === 'string' &&
    typeof value.workspaceId === 'string' &&
    typeof value.title === 'string' &&
    typeof value.content === 'string' &&
    typeof value.status === 'string' &&
    STATUS_VALUES.has(value.status) &&
    typeof value.starred === 'boolean' &&
    typeof value.archived === 'boolean' &&
    Array.isArray(value.fields) &&
    value.fields.every(
      (field) =>
        isObject(field) &&
        typeof field.id === 'string' &&
        typeof field.name === 'string' &&
        typeof field.value === 'string',
    ) &&
    typeof value.priority === 'string' &&
    PRIORITY_VALUES.has(value.priority) &&
    isNullableDate(value.dueDate) &&
    typeof value.done === 'boolean' &&
    isNullableDate(value.planDate) &&
    isNullableTime(value.planStart) &&
    isNullableTime(value.planEnd) &&
    (value.sub === undefined || value.sub === null || value.sub === 'vertical' || value.sub === 'horizontal') &&
    (value.projectId === null || typeof value.projectId === 'string') &&
    (recurrence === null ||
      (isObject(recurrence) &&
        typeof recurrence.frequency === 'string' &&
        RECURRENCE_VALUES.has(recurrence.frequency) &&
        typeof recurrence.interval === 'number' &&
        Number.isInteger(recurrence.interval) &&
        recurrence.interval > 0)) &&
    (literature === null ||
      (isObject(literature) &&
        typeof literature.authors === 'string' &&
        (literature.year === null ||
          (typeof literature.year === 'number' && Number.isInteger(literature.year))) &&
        typeof literature.doi === 'string' &&
        typeof literature.url === 'string' &&
        typeof literature.readingStatus === 'string' &&
        READING_VALUES.has(literature.readingStatus))) &&
    typeof value.createdAt === 'number' &&
    Number.isFinite(value.createdAt) &&
    typeof value.updatedAt === 'number' &&
    Number.isFinite(value.updatedAt) &&
    (value.order === undefined || (typeof value.order === 'number' && Number.isFinite(value.order)))
  );
}

function isTypeDef(value: unknown): value is TypeDef {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.kind === 'string' &&
    TYPE_KIND_VALUES.has(value.kind) &&
    isTypeIcon(value.icon) &&
    typeof value.note === 'string' &&
    typeof value.builtin === 'boolean'
  );
}

function isWorkspace(value: unknown): value is Workspace {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.builtin === 'boolean'
  );
}

function hasUniqueIds(items: Array<{ id: string }>): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function snapshotOf(state: WorkbenchState, patch: Partial<WorkbenchSnapshot> = {}): WorkbenchSnapshot {
  if (!state.settings) throw new Error('应用尚未完成初始化');
  return {
    records: patch.records ?? state.records,
    types: patch.types ?? state.types,
    workspaces: patch.workspaces ?? state.workspaces,
    settings: patch.settings ?? state.settings,
  };
}

export function createWorkbenchStore(repository: WorkbenchRepository) {
  return create<WorkbenchState>((set, get) => {
    const fail = (error: unknown): never => {
      set({ error: errorMessage(error) });
      throw error;
    };

    const replaceSnapshot = async (snapshot: WorkbenchSnapshot): Promise<void> => {
      try {
        await repository.replaceAll(snapshot);
        set({ ...snapshot, displayName: snapshot.settings.displayName, error: null });
      } catch (error) {
        fail(error);
      }
    };

    return {
      phase: 'loading',
      error: null,
      records: [],
      types: [],
      workspaces: [],
      settings: null,
      view: 'dashboard',
      workspaceFilter: 'all',
      search: '',
      statusFilter: 'all',
      displayName: '',

      hydrate: async () => {
        set({ phase: 'loading', error: null });
        try {
          await repository.initialize();
          const snapshot = await repository.loadSnapshot();
          set({
            ...snapshot,
            displayName: snapshot.settings.displayName,
            phase: 'ready',
            error: null,
          });
        } catch (error) {
          set({ phase: 'error', error: errorMessage(error) });
          throw error;
        }
      },

      addRecord: async (partial) => {
        const now = Date.now();
        const record: RecordItem = {
          id: uid(),
          workspaceId:
            get().workspaceFilter !== 'all'
              ? get().workspaceFilter
              : (get().workspaces[0]?.id ?? 'ws-default'),
          content: '',
          status: 'active',
          starred: false,
          archived: false,
          fields: [],
          priority: 'none',
          dueDate: null,
          done: false,
          planDate: null,
          planStart: null,
          planEnd: null,
          projectId: null,
          recurrence: null,
          literature: null,
          createdAt: now,
          updatedAt: now,
          ...partial,
        };
        try {
          await repository.saveRecord(record);
          set((state) => ({ records: [record, ...state.records], error: null }));
          return record;
        } catch (error) {
          return fail(error);
        }
      },

      updateRecord: async (id, patch) => {
        const current = get().records.find((record) => record.id === id);
        if (!current) return;
        const next = { ...current, ...patch, updatedAt: Date.now() };
        try {
          await repository.saveRecord(next);
          set((state) => ({
            records: state.records.map((record) => (record.id === id ? next : record)),
            error: null,
          }));
        } catch (error) {
          fail(error);
        }
      },

      duplicateRecord: async (id) => {
        const source = get().records.find((record) => record.id === id);
        if (!source) return;
        const now = Date.now();
        const copy: RecordItem = {
          ...source,
          id: uid(),
          title: `${source.title}（副本）`,
          fields: source.fields.map((field) => ({ ...field, id: uid() })),
          done: false,
          createdAt: now,
          updatedAt: now,
        };
        try {
          await repository.saveRecord(copy);
          set((state) => ({ records: [copy, ...state.records], error: null }));
        } catch (error) {
          fail(error);
        }
      },

      archiveRecord: async (id, archived) => get().updateRecord(id, { archived }),

      deleteRecord: async (id) => {
        try {
          await repository.deleteRecord(id);
          set((state) => ({
            records: state.records
              .filter((record) => record.id !== id)
              .map((record) => (record.projectId === id ? { ...record, projectId: null } : record)),
            error: null,
          }));
        } catch (error) {
          fail(error);
        }
      },

      clearDone: async (typeId) => {
        const records = get().records.filter(
          (record) => !(record.typeId === typeId && record.done && !record.archived),
        );
        await replaceSnapshot(snapshotOf(get(), { records }));
      },

      toggleStar: async (id) => {
        const record = get().records.find((item) => item.id === id);
        if (record) await get().updateRecord(id, { starred: !record.starred });
      },

      toggleDone: async (id) => {
        const record = get().records.find((item) => item.id === id);
        if (!record) return;
        if (record.done) await get().updateRecord(id, { done: false });
        else await get().completeTodo(id);
      },

      completeTodo: async (id, completedAt = Date.now()) => {
        try {
          const result = await repository.completeTodo(id, completedAt);
          set((state) => ({
            records: [
              ...(result.next ? [result.next] : []),
              ...state.records.map((record) =>
                record.id === result.completed.id ? result.completed : record,
              ),
            ],
            error: null,
          }));
        } catch (error) {
          fail(error);
        }
      },

      updateRecords: async (ids, patch) => {
        try {
          const updated = await repository.updateRecords(ids, patch);
          const byId = new Map(updated.map((record) => [record.id, record]));
          set((state) => ({
            records: state.records.map((record) => byId.get(record.id) ?? record),
            error: null,
          }));
        } catch (error) {
          fail(error);
        }
      },

      deleteRecords: async (ids) => {
        try {
          await repository.deleteRecords(ids);
          const deleted = new Set(ids);
          set((state) => ({
            records: state.records
              .filter((record) => !deleted.has(record.id))
              .map((record) => record.projectId && deleted.has(record.projectId) ? { ...record, projectId: null } : record),
            error: null,
          }));
        } catch (error) {
          fail(error);
        }
      },

      addType: async (name, kind = 'generic') => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const type: TypeDef = {
          id: uid(),
          name: trimmed,
          kind,
          icon: 'tag',
          note: pickNote(trimmed + String(get().types.length), get().types.map((item) => item.note)),
          builtin: false,
        };
        try {
          await repository.saveType(type);
          set((state) => ({ types: [...state.types, type], error: null }));
        } catch (error) {
          fail(error);
        }
      },

      renameType: async (id, name) => {
        const trimmed = name.trim();
        const type = get().types.find((item) => item.id === id);
        if (!trimmed || !type) return;
        const next = { ...type, name: trimmed };
        try {
          await repository.saveType(next);
          set((state) => ({
            types: state.types.map((item) => (item.id === id ? next : item)),
            error: null,
          }));
        } catch (error) {
          fail(error);
        }
      },

      deleteType: async (id) => {
        if (!get().types.some((type) => type.id === id)) return;
        try {
          await repository.deleteType(id);
          set((state) => ({
            types: state.types.filter((type) => type.id !== id),
            records: state.records.filter((record) => record.typeId !== id),
            view: state.view === id ? 'dashboard' : state.view,
            error: null,
          }));
        } catch (error) {
          fail(error);
        }
      },

      reorderType: async (id, targetId, after) => {
        if (id === targetId) return;
        const types = [...get().types];
        const from = types.findIndex((type) => type.id === id);
        if (from < 0 || !types.some((type) => type.id === targetId)) return;
        const [moved] = types.splice(from, 1);
        let index = types.findIndex((type) => type.id === targetId);
        if (after) index += 1;
        types.splice(index, 0, moved);
        await replaceSnapshot(snapshotOf(get(), { types }));
      },

      reorderRecord: async (id, targetId, after) => {
        if (id === targetId) return;
        const source = get().records.find((record) => record.id === id);
        if (!source) return;
        const siblings = get()
          .records.filter((record) => record.typeId === source.typeId && !record.archived)
          .sort((left, right) => orderKey(left) - orderKey(right));
        if (!siblings.some((record) => record.id === targetId)) return;
        const ids = siblings.map((record) => record.id).filter((recordId) => recordId !== id);
        let index = ids.indexOf(targetId);
        if (after) index += 1;
        ids.splice(index, 0, id);
        const orderById = new Map(ids.map((recordId, order) => [recordId, (order + 1) * 10]));
        const records = get().records.map((record) =>
          orderById.has(record.id) ? { ...record, order: orderById.get(record.id)! } : record,
        );
        await replaceSnapshot(snapshotOf(get(), { records }));
      },

      addWorkspace: async (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const workspace = { id: uid(), name: trimmed, builtin: false };
        try {
          await repository.saveWorkspace(workspace);
          set((state) => ({ workspaces: [...state.workspaces, workspace], error: null }));
        } catch (error) {
          fail(error);
        }
      },

      renameWorkspace: async (id, name) => {
        const trimmed = name.trim();
        const workspace = get().workspaces.find((item) => item.id === id);
        if (!trimmed || !workspace) return;
        const next = { ...workspace, name: trimmed };
        try {
          await repository.saveWorkspace(next);
          set((state) => ({
            workspaces: state.workspaces.map((item) => (item.id === id ? next : item)),
            error: null,
          }));
        } catch (error) {
          fail(error);
        }
      },

      deleteWorkspace: async (id) => {
        const workspace = get().workspaces.find((item) => item.id === id);
        if (!workspace || workspace.builtin) return;
        try {
          await repository.deleteWorkspace(id);
          const fallback = get().workspaces.find((item) => item.id !== id)?.id ?? 'ws-default';
          set((state) => ({
            workspaces: state.workspaces.filter((item) => item.id !== id),
            records: state.records.map((record) =>
              record.workspaceId === id ? { ...record, workspaceId: fallback } : record,
            ),
            workspaceFilter: state.workspaceFilter === id ? 'all' : state.workspaceFilter,
            error: null,
          }));
        } catch (error) {
          fail(error);
        }
      },

      setView: (view) => set({ view, statusFilter: 'all' }),
      setWorkspaceFilter: (workspaceFilter) => set({ workspaceFilter }),
      setSearch: (search) => set({ search }),
      setStatusFilter: (statusFilter) => set({ statusFilter }),

      updateSettings: async (patch) => {
        const settings = get().settings;
        if (!settings) return;
        const next = { ...settings, ...patch };
        try {
          await repository.saveSettings(next);
          set({ settings: next, displayName: next.displayName, error: null });
        } catch (error) {
          fail(error);
        }
      },

      setDisplayName: async (name) => get().updateSettings({ displayName: name.trim() }),

      exportData: () => ({
        app: 'research-workbench',
        version: 1,
        exportedAt: new Date().toISOString(),
        records: get().records,
        types: get().types,
        workspaces: get().workspaces,
      }),

      importData: async (payload) => {
        if (
          !isObject(payload) ||
          payload.app !== 'research-workbench' ||
          (payload.version !== 1 && payload.version !== 2)
        ) {
          return { ok: false, error: '这不是受支持的 Research Workbench 备份' };
        }
        if (!Array.isArray(payload.records) || !Array.isArray(payload.types) || !Array.isArray(payload.workspaces)) {
          return { ok: false, error: '缺少 records / types / workspaces 字段' };
        }
        if (!payload.records.every(isRecord)) return { ok: false, error: '记录格式不正确' };
        if (!payload.types.every(isTypeDef) || !payload.workspaces.every(isWorkspace)) {
          return { ok: false, error: '类型或工作区格式不正确' };
        }
        if (payload.types.length === 0 || payload.workspaces.length === 0) {
          return { ok: false, error: '类型与工作区不能为空' };
        }
        let importedSettings: AppSettings | undefined;
        if (payload.version === 2) {
          if (!isAppSettings(payload.settings)) return { ok: false, error: '设置格式不正确' };
          importedSettings = payload.settings;
        }
        if (!hasUniqueIds(payload.records) || !hasUniqueIds(payload.types) || !hasUniqueIds(payload.workspaces)) {
          return { ok: false, error: '备份中存在重复 ID' };
        }
        const typeIds = new Set(payload.types.map((type) => type.id));
        const workspaceIds = new Set(payload.workspaces.map((workspace) => workspace.id));
        const recordIds = new Set(payload.records.map((record) => record.id));
        if (
          !payload.records.every(
            (record) =>
              typeIds.has(record.typeId) &&
              workspaceIds.has(record.workspaceId) &&
              (!record.projectId || recordIds.has(record.projectId)),
          )
        ) {
          return { ok: false, error: '记录引用了不存在的类型、工作区或项目' };
        }
        await replaceSnapshot(
          snapshotOf(get(), {
            records: payload.records,
            types: payload.types,
            workspaces: payload.workspaces,
            ...(importedSettings ? { settings: importedSettings } : {}),
          }),
        );
        set({ view: 'dashboard', workspaceFilter: 'all', search: '', statusFilter: 'all' });
        return { ok: true };
      },

      resetSample: async () => {
        const current = get();
        const snapshot: WorkbenchSnapshot = {
          records: buildSampleRecords(),
          types: BUILTIN_TYPES.map((type) => ({ ...type })),
          workspaces: BUILTIN_WORKSPACES.map((workspace) => ({ ...workspace })),
          settings: current.settings!,
        };
        await replaceSnapshot(snapshot);
        set({ view: 'dashboard', workspaceFilter: 'all', search: '', statusFilter: 'all' });
      },
    };
  });
}
