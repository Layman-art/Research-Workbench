import { create } from 'zustand';
import type {
  AppSettings,
  ActivityEvent,
  ExportPayload,
  RecordItem,
  TypeDef,
  WorkbenchSnapshot,
  Workspace,
} from '../domain/models';
import type { BatchRecordPatch, WorkbenchRepository } from '../repositories/WorkbenchRepository';
import { BUILTIN_TYPES, BUILTIN_WORKSPACES, buildSampleRecords, ensureScheduleType, mergeProjectTypes } from '../sample';
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
  activities: ActivityEvent[];
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
  whenIdle: () => Promise<void>;
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
  restoreRecords: (ids: string[]) => Promise<void>;
  permanentlyDeleteRecords: (ids: string[]) => Promise<void>;
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
    typeof value.id === 'string' && value.id.length > 0 &&
    (value.deletedAt === undefined || value.deletedAt === null || (typeof value.deletedAt === 'number' && Number.isFinite(value.deletedAt))) &&
    (value.attachments === undefined || (Array.isArray(value.attachments) && value.attachments.every((file) =>
      isObject(file) && typeof file.id === 'string' && typeof file.name === 'string' && typeof file.path === 'string' &&
      ['file', 'directory'].includes(String(file.kind))))) &&
    typeof value.typeId === 'string' &&
    typeof value.workspaceId === 'string' &&
    typeof value.title === 'string' &&
    typeof value.content === 'string' &&
    typeof value.status === 'string' &&
    STATUS_VALUES.has(value.status) &&
    typeof value.starred === 'boolean' &&
    typeof value.archived === 'boolean' &&
    Array.isArray(value.fields) &&
    new Set(value.fields.map((field) => isObject(field) ? field.id : undefined)).size === value.fields.length &&
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

const DEFAULT_SETTINGS: AppSettings = {
  displayName: '', theme: 'system', motion: 'system', projectViewMode: 'list',
  closeToTray: true, autoLaunch: false, notificationsEnabled: false,
};

function validateRecordLinks(record: RecordItem, state: Pick<WorkbenchSnapshot, 'records' | 'types' | 'workspaces'>): void {
  if (!isRecord(record)) throw new Error('记录格式不正确');
  if (!state.types.some((type) => type.id === record.typeId) || !state.workspaces.some((workspace) => workspace.id === record.workspaceId)) {
    throw new Error('记录引用了不存在的类型或工作区');
  }
  if (record.planStart && record.planEnd && record.planEnd < record.planStart) throw new Error('结束时间不能早于开始时间');
  if (record.projectId) {
    const project = state.records.find((item) => item.id === record.projectId);
    if (!project || project.id === record.id || project.workspaceId !== record.workspaceId ||
        !state.types.some((type) => type.id === project.typeId && type.kind === 'project')) {
      throw new Error('关联项目必须是同一工作区的有效科研项目');
    }
  }
}

export type ImportValidation = { ok: false; error: string } | {
  ok: true;
  snapshot: WorkbenchSnapshot;
  summary: { records: number; types: number; workspaces: number; trashed: number; activities: number };
  warnings: string[];
};

/** Pure preview. The same validation runs again immediately before the atomic import. */
export function validateImportData(payload: unknown, fallbackSettings = DEFAULT_SETTINGS): ImportValidation {
  if (!isObject(payload) || payload.app !== 'research-workbench' || (typeof payload.version !== 'number' || ![1, 2, 3].includes(payload.version))) {
    return { ok: false, error: '这不是受支持的 Research Workbench 备份' };
  }
  if (!Array.isArray(payload.records) || !Array.isArray(payload.types) || !Array.isArray(payload.workspaces)) {
    return { ok: false, error: '缺少 records / types / workspaces 字段' };
  }
  const legacy = payload.version === 1;
  const records = payload.records.map((record) => !isObject(record) ? record : ({
    ...record,
    ...(legacy ? { planDate: record.planDate ?? null, planStart: record.planStart ?? null, planEnd: record.planEnd ?? null } : {}),
    projectId: record.projectId ?? null, recurrence: record.recurrence ?? null, literature: record.literature ?? null,
  }));
  const sourceTypes = payload.types.map((type) => !isObject(type) ? type : ({ ...type, note: type.note ?? pickNote(String(type.id), []) }));
  if (!records.every(isRecord)) return { ok: false, error: '记录格式不正确' };
  if (!sourceTypes.every(isTypeDef) || !payload.workspaces.every(isWorkspace)) return { ok: false, error: '类型或工作区格式不正确' };
  if (!sourceTypes.length || !payload.workspaces.length) return { ok: false, error: '类型与工作区不能为空' };
  if (!hasUniqueIds(records) || !hasUniqueIds(sourceTypes) || !hasUniqueIds(payload.workspaces)) return { ok: false, error: '备份中存在重复 ID' };
  let types = sourceTypes;
  let migratedRecords = records;
  if (legacy) {
    const migrated = mergeProjectTypes(ensureScheduleType(types), records);
    types = migrated.types;
    migratedRecords = migrated.records;
    if (!types.some((type) => type.id === 'literature')) types = [...types, ...BUILTIN_TYPES.filter((type) => type.id === 'literature')];
  }
  const settings = legacy ? fallbackSettings : payload.settings;
  if (!isAppSettings(settings)) return { ok: false, error: '设置格式不正确' };
  const activities = payload.activities ?? [];
  if (!Array.isArray(activities) || !activities.every((event) => isObject(event) &&
      typeof event.id === 'string' && typeof event.recordId === 'string' && typeof event.recordTitle === 'string' &&
      typeof event.typeId === 'string' && typeof event.workspaceId === 'string' &&
      ['created','updated','completed','deleted','restored'].includes(String(event.kind)) &&
      typeof event.occurredAt === 'number' && Number.isFinite(event.occurredAt)) || !hasUniqueIds(activities as ActivityEvent[])) {
    return { ok: false, error: '活动记录格式不正确' };
  }
  const snapshot: WorkbenchSnapshot = { records: migratedRecords, types, workspaces: payload.workspaces, settings, activities: activities as ActivityEvent[] };
  try { for (const record of snapshot.records) validateRecordLinks(record, snapshot); }
  catch (error) { return { ok: false, error: errorMessage(error) }; }
  return { ok: true, snapshot, summary: { records: snapshot.records.length, types: types.length,
    workspaces: snapshot.workspaces.length, trashed: snapshot.records.filter((record) => record.deletedAt).length,
    activities: activities.length }, warnings: legacy ? ['已补齐旧版字段并迁移项目类型；旧备份不包含编辑草稿和历史活动。'] : [] };
}

export function createWorkbenchStore(repository: WorkbenchRepository) {
  return create<WorkbenchState>((set, get) => {
    let pending: Promise<unknown> = Promise.resolve();
    const enqueue = <T,>(work: () => Promise<T>): Promise<T> => {
      const result = pending.then(work);
      pending = result.catch(() => undefined);
      return result;
    };
    const refreshActivities = async () => {
      try {
        const previous = get().activities;
        const latest = await repository.loadActivities(previous[0]?.occurredAt);
        const byId = new Map([...previous, ...latest].map((event) => [event.id, event]));
        const cutoff = Date.now() - 366 * 86_400_000;
        set({ activities: [...byId.values()].filter((event) => event.occurredAt >= cutoff).sort((a, b) => b.occurredAt - a.occurredAt) });
      }
      catch { set({ error: '记录已保存，但活动历史刷新失败；重新打开可重试' }); }
    };
    const fail = (error: unknown): never => {
      set({ error: errorMessage(error) });
      throw error;
    };

    const replaceSnapshot = async (snapshot: WorkbenchSnapshot): Promise<void> => {
      try {
        await repository.replaceAll(snapshot);
        set({ ...snapshot, activities: snapshot.activities ?? [], displayName: snapshot.settings.displayName, error: null });
      } catch (error) {
        fail(error);
      }
    };

    return {
      whenIdle: async () => { await pending; },
      activities: [],
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

      hydrate: () => enqueue(async () => {
        set({ phase: 'loading', error: null });
        try {
          await repository.initialize();
          const snapshot = await repository.loadSnapshot();
          set({
            ...snapshot,
            activities: snapshot.activities ?? [],
            displayName: snapshot.settings.displayName,
            phase: 'ready',
            error: null,
          });
        } catch (error) {
          set({ phase: 'error', error: errorMessage(error) });
          throw error;
        }
      }),

      addRecord: (partial) => enqueue(async () => {
        const existing = partial.id ? get().records.find((record) => record.id === partial.id) : undefined;
        if (existing) return existing;
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
        validateRecordLinks(record, get());
        try {
          await repository.saveRecord(record);
          set((state) => ({ records: [record, ...state.records], error: null }));
          await refreshActivities();
          return record;
        } catch (error) {
          return fail(error);
        }
      }),

      updateRecord: (id, patch) => enqueue(async () => {
        const current = get().records.find((record) => record.id === id);
        if (!current) return;
        const next = { ...current, ...patch, id: current.id, createdAt: current.createdAt, updatedAt: Date.now() };
        validateRecordLinks(next, get());
        try {
          await repository.saveRecord(next);
          set((state) => ({
            records: state.records.map((record) => (record.id === id ? next : record)),
            error: null,
          }));
          await refreshActivities();
        } catch (error) {
          fail(error);
        }
      }),

      duplicateRecord: (id) => enqueue(async () => {
        const source = get().records.find((record) => record.id === id);
        if (!source) return;
        const now = Date.now();
        const copy: RecordItem = {
          ...source,
          id: uid(),
          title: `${source.title}（副本）`,
          fields: source.fields.map((field) => ({ ...field, id: uid() })),
          done: false,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        try {
          await repository.saveRecord(copy);
          set((state) => ({ records: [copy, ...state.records], error: null }));
          await refreshActivities();
        } catch (error) {
          fail(error);
        }
      }),

      archiveRecord: async (id, archived) => get().updateRecord(id, { archived }),

      deleteRecord: async (id) => get().deleteRecords([id]),

      clearDone: async (typeId) => {
        const state = get();
        const ids = state.records.filter((record) => record.typeId === typeId && record.done && !record.archived && !record.deletedAt &&
          (state.workspaceFilter === 'all' || record.workspaceId === state.workspaceFilter)).map((record) => record.id);
        await get().deleteRecords(ids);
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

      completeTodo: (id, completedAt = Date.now()) => enqueue(async () => {
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
          await refreshActivities();
        } catch (error) {
          fail(error);
        }
      }),

      updateRecords: (ids, patch) => enqueue(async () => {
        try {
          const updated = await repository.updateRecords(ids, patch);
          const byId = new Map(updated.map((record) => [record.id, record]));
          set((state) => ({
            records: state.records.map((record) => byId.get(record.id) ?? record),
            error: null,
          }));
          await refreshActivities();
        } catch (error) {
          fail(error);
        }
      }),

      deleteRecords: (ids) => enqueue(async () => {
        try {
          await repository.deleteRecords(ids);
          const snapshot = await repository.loadSnapshot();
          set({ records: snapshot.records, activities: snapshot.activities ?? [], error: null });
        } catch (error) { fail(error); }
      }),

      restoreRecords: (ids) => enqueue(async () => {
        try {
          await repository.restoreRecords(ids);
          const snapshot = await repository.loadSnapshot();
          set({ records: snapshot.records, activities: snapshot.activities ?? [], error: null });
        } catch (error) { fail(error); }
      }),

      permanentlyDeleteRecords: (ids) => enqueue(async () => {
        try {
          await repository.permanentlyDeleteRecords(ids);
          const snapshot = await repository.loadSnapshot();
          set({ records: snapshot.records, activities: snapshot.activities ?? [], error: null });
        } catch (error) { fail(error); }
      }),

      addType: (name, kind = 'generic') => enqueue(async () => {
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
      }),

      renameType: (id, name) => enqueue(async () => {
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
      }),

      deleteType: (id) => enqueue(async () => {
        const type = get().types.find((item) => item.id === id);
        if (!type) return;
        if (type.builtin) return fail(new Error('内置类型不能删除'));
        if (get().records.some((record) => record.typeId === id)) return fail(new Error('此类型仍有记录（含回收站），请先迁移记录'));
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
      }),

      reorderType: (id, targetId, after) => enqueue(async () => {
        if (id === targetId) return;
        const types = [...get().types];
        const from = types.findIndex((type) => type.id === id);
        if (from < 0 || !types.some((type) => type.id === targetId)) return;
        const [moved] = types.splice(from, 1);
        let index = types.findIndex((type) => type.id === targetId);
        if (after) index += 1;
        types.splice(index, 0, moved);
        await repository.reorderTypes(types.map((type) => type.id));
        set({ types, error: null });
      }),

      reorderRecord: (id, targetId, after) => enqueue(async () => {
        if (id === targetId) return;
        const source = get().records.find((record) => record.id === id);
        if (!source) return;
        const siblings = get()
          .records.filter((record) => record.typeId === source.typeId && record.workspaceId === source.workspaceId && !record.archived && !record.deletedAt)
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
        await repository.reorderRecords([...orderById].map(([id, order]) => ({ id, order })));
        set({ records, error: null });
      }),

      addWorkspace: (name) => enqueue(async () => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const workspace = { id: uid(), name: trimmed, builtin: false };
        try {
          await repository.saveWorkspace(workspace);
          set((state) => ({ workspaces: [...state.workspaces, workspace], error: null }));
        } catch (error) {
          fail(error);
        }
      }),

      renameWorkspace: (id, name) => enqueue(async () => {
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
      }),

      deleteWorkspace: (id) => enqueue(async () => {
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
      }),

      setView: (view) => set({ view, statusFilter: 'all' }),
      setWorkspaceFilter: (workspaceFilter) => set({ workspaceFilter }),
      setSearch: (search) => set({ search }),
      setStatusFilter: (statusFilter) => set({ statusFilter }),

      updateSettings: (patch) => enqueue(async () => {
        const settings = get().settings;
        if (!settings) return;
        const next = { ...settings, ...patch };
        try {
          await repository.saveSettings(next);
          set({ settings: next, displayName: next.displayName, error: null });
        } catch (error) {
          fail(error);
        }
      }),

      setDisplayName: async (name) => get().updateSettings({ displayName: name.trim() }),

      exportData: () => {
        const current = get();
        if (!current.settings) throw new Error('应用尚未完成初始化');
        return {
          app: 'research-workbench',
          version: 3,
          activities: current.activities,
          exportedAt: new Date().toISOString(),
          records: current.records,
          types: current.types,
          workspaces: current.workspaces,
          settings: current.settings,
        };
      },

      importData: (payload) => enqueue(async () => {
        const result = validateImportData(payload, get().settings ?? undefined);
        if (!result.ok) return result;
        await replaceSnapshot(result.snapshot);
        set({ view: 'dashboard', workspaceFilter: 'all', search: '', statusFilter: 'all' });
        return { ok: true };
      }),

      resetSample: () => enqueue(async () => {
        const current = get();
        const snapshot: WorkbenchSnapshot = {
          records: buildSampleRecords(),
          types: BUILTIN_TYPES.map((type) => ({ ...type })),
          workspaces: BUILTIN_WORKSPACES.map((workspace) => ({ ...workspace })),
          settings: current.settings!,
          activities: [],
        };
        await replaceSnapshot(snapshot);
        set({ view: 'dashboard', workspaceFilter: 'all', search: '', statusFilter: 'all' });
      }),
    };
  });
}
