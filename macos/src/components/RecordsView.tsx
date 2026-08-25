import { useMemo, useState, Fragment, lazy, Suspense } from 'react';
import type { DragEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import clsx from 'clsx';
import {
  Plus,
  GripVertical,
  Pencil,
  Copy,
  Archive,
  Trash2,
  Star,
  ListChecks,
  Key,
  Target,
  Building2,
  Users,
  Hash,
  User,
  CalendarClock,
  Wallet,
  Boxes,
  MapPin,
  Tag,
} from 'lucide-react';
import { useStore } from '../stores';
import { filterRecords } from '../store/selectors';
import { STATUS_LABEL } from '../types';
import type { RecordItem } from '../types';
import { RecordRow, StatusPill } from './RecordRow';
import type { RowDnd } from './RecordRow';
import { Empty } from './Dashboard';
import { InlineNotes } from './MusicNotes';
import { requestEditor } from '../editorBus';
import { confirmDialog } from '../confirmBus';
import { orderKey } from '../planUtils';
import { formatDate } from '../utils';
import { MarkdownPreview } from '../features/markdown/MarkdownPreview';
import { desktopPlatform } from '../platform';
import { ProjectNextActions } from '../features/projects/ProjectNextActions';
import { useRecordSelection } from '../features/selection/useRecordSelection';
import { BulkActionBar } from '../features/selection/BulkActionBar';

const ProjectBoard = lazy(() =>
  import('../features/projects/ProjectBoard').then((module) => ({ default: module.ProjectBoard })),
);

const STATUS_FILTERS: Array<{ key: string; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'planned', label: STATUS_LABEL.planned },
  { key: 'active', label: STATUS_LABEL.active },
  { key: 'paused', label: STATUS_LABEL.paused },
  { key: 'done', label: STATUS_LABEL.done },
  { key: 'archived', label: '已归档' },
];

/** 根据字段名返回一个贴切的图标（用于方向卡片自定义字段标签） */
function fieldIcon(name: string) {
  if (/关键词|keyword/i.test(name)) return Key;
  if (/目标|阶段|状态|当前/.test(name)) return Target;
  if (/甲方|合作方|客户|牵头|单位/.test(name)) return Building2;
  if (/角色|分工|负责/.test(name)) return User;
  if (/编号|ID|id/.test(name)) return Hash;
  if (/执行期|交付|时间|节点|期限/.test(name)) return CalendarClock;
  if (/经费|到账|预算|合同额|账户/.test(name)) return Wallet;
  if (/范围|包含|内容|核心|模块/.test(name)) return Boxes;
  if (/位置|存储|路径|地址/.test(name)) return MapPin;
  if (/成员|团队|人员/.test(name)) return Users;
  return Tag;
}

/** 科研方向专用宽卡片：主次优先级 + 多行正文 + 竖排自定义字段 */
function DirectionCard({ record, dnd, selection }: { record: RecordItem; dnd?: RowDnd; selection?: { checked: boolean; onToggle: () => void } }) {
  const { workspaces, archiveRecord, duplicateRecord, deleteRecord, updateRecord } = useStore(
    useShallow((state) => ({
      workspaces: state.workspaces,
      archiveRecord: state.archiveRecord,
      duplicateRecord: state.duplicateRecord,
      deleteRecord: state.deleteRecord,
      updateRecord: state.updateRecord,
    })),
  );
  const ws = workspaces.find((w) => w.id === record.workspaceId);
  const isMain = record.priority === 'high';

  const onDelete = async () => {
    const confirmed = await confirmDialog({
      message: `确定删除「${record.title}」吗？此操作不可恢复。`,
      confirmLabel: '删除',
      danger: true,
    });
    if (confirmed) deleteRecord(record.id);
  };

  return (
    <div
      className={clsx('card record-card', dnd?.className)}
      draggable={!!dnd}
      onDragStart={dnd?.onDragStart}
      onDragEnd={dnd?.onDragEnd}
      onDragOver={dnd?.onDragOver}
      onDragLeave={dnd?.onDragLeave}
      onDrop={dnd?.onDrop}
    >
      <div className="rc-head">
        {selection && <input className="record-select" type="checkbox" aria-label={`选择「${record.title}」`} checked={selection.checked} onChange={selection.onToggle} />}
        <GripVertical size={14} className="grip rc-grip" />
        <button
          className={clsx('star-btn', isMain && 'on')}
          onClick={() => updateRecord(record.id, { priority: isMain ? 'none' : 'high' })}
          title={isMain ? '主要方向（点击降为次要）' : '设为主要方向'}
        >
          <Star size={16} fill={isMain ? 'currentColor' : 'none'} />
        </button>
        <div
          className="rc-title serif"
          onClick={() => requestEditor({ recordId: record.id })}
          role="button"
          tabIndex={0}
        >
          {record.title}
        </div>
        <div className="rc-actions">
          <button className="icon-btn" title="编辑" onClick={() => requestEditor({ recordId: record.id })}>
            <Pencil size={15} />
          </button>
          <button className="icon-btn" title="复制" onClick={() => duplicateRecord(record.id)}>
            <Copy size={15} />
          </button>
          <button
            className="icon-btn"
            title={record.archived ? '取消归档' : '归档'}
            onClick={() => archiveRecord(record.id, !record.archived)}
          >
            <Archive size={15} />
          </button>
          <button className="icon-btn danger" title="删除" onClick={onDelete}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      {record.content && (
        <MarkdownPreview
          source={record.content}
          className="rc-content direction-markdown"
          onOpenExternal={(url) => desktopPlatform.openExternal(url)}
        />
      )}
      {record.fields.length > 0 && (
        <div className="rc-fields">
          {record.fields.map((f) => {
            const Icon = fieldIcon(f.name);
            return (
              <div className="rc-field" key={f.id}>
                <b>
                  <Icon size={13} className="rc-field-icon" />
                  {f.name}
                </b>
                <span>{f.value}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="rc-foot">
        {record.archived ? (
          <span className="pill pill-archived">已归档</span>
        ) : (
          <StatusPill status={record.status} />
        )}
        {ws && <span>{ws.name}</span>}
        <span style={{ marginLeft: 'auto' }}>更新于 {formatDate(record.updatedAt)}</span>
      </div>
    </div>
  );
}

export function RecordsView({ typeId }: { typeId: string }) {
  const {
    records: allRecords,
    types,
    workspaceFilter,
    search,
    statusFilter,
    setStatusFilter,
    reorderRecord,
    settings,
    updateSettings,
    updateRecord,
    workspaces,
    updateRecords,
    deleteRecords,
  } = useStore(
    useShallow((state) => ({
      records: state.records,
      types: state.types,
      workspaceFilter: state.workspaceFilter,
      search: state.search,
      statusFilter: state.statusFilter,
      setStatusFilter: state.setStatusFilter,
      reorderRecord: state.reorderRecord,
      settings: state.settings,
      updateSettings: state.updateSettings,
      updateRecord: state.updateRecord,
      workspaces: state.workspaces,
      updateRecords: state.updateRecords,
      deleteRecords: state.deleteRecords,
    })),
  );
  const type = types.find((t) => t.id === typeId);

  const records = useMemo(
    () =>
      filterRecords({
        records: allRecords,
        typeId,
        workspaceId: workspaceFilter,
        status: statusFilter,
        query: search,
      }),
    [allRecords, search, statusFilter, typeId, workspaceFilter],
  );
  const boardProjects = useMemo(
    () =>
      filterRecords({
        records: allRecords,
        typeId,
        workspaceId: workspaceFilter,
        status: 'all',
        query: search,
      }),
    [allRecords, search, typeId, workspaceFilter],
  );

  // 手动排序（order）优先，未设置时按更新时间倒序兜底；科研方向：主要方向在前
  const sorted = useMemo(() => {
    const list = [...records].sort((a, b) => orderKey(a) - orderKey(b));
    if (type?.kind === 'direction') {
      return list
        .filter((r) => r.priority === 'high')
        .concat(list.filter((r) => r.priority !== 'high'));
    }
    return list;
  }, [records, type?.kind]);

  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; after: boolean } | null>(null);
  const selection = useRecordSelection(sorted.map((record) => record.id));
  const selectionFor = (record: RecordItem) => selection.selecting
    ? { checked: selection.selected.has(record.id), onToggle: () => selection.toggle(record.id) }
    : undefined;

  // 科研项目：按纵向 / 横向细分分组（组内保持手动排序）
  const subGroups = useMemo(() => {
    if (type?.kind !== 'project') return [];
    const vertical = sorted.filter((r) => r.sub === 'vertical');
    const horizontal = sorted.filter((r) => r.sub === 'horizontal');
    const other = sorted.filter((r) => r.sub !== 'vertical' && r.sub !== 'horizontal');
    return [
      { key: 'vertical', label: '纵向项目', items: vertical },
      { key: 'horizontal', label: '横向项目', items: horizontal },
      { key: 'other', label: '未分类', items: other },
    ].filter((g) => g.items.length > 0);
  }, [type?.kind, sorted]);

  if (!type) return null;

  const isDirection = type.kind === 'direction';
  const isProject = type.kind === 'project';
  const todoTypeId = types.find((candidate) => candidate.kind === 'todo')?.id ?? 'todo';

  const endDrag = () => {
    setDragId(null);
    setOver(null);
  };

  /** 卡片网格：上沿 30% 插前，下沿 30% 插后，中间带按横向中点；横版行：纵向中点 */
  const dropAfter = (e: DragEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!isDirection) return e.clientY > rect.top + rect.height / 2;
    const cy = (e.clientY - rect.top) / rect.height;
    const cx = (e.clientX - rect.left) / rect.width;
    return cy < 0.3 ? false : cy > 0.7 ? true : cx > 0.5;
  };

  const dndFor = (r: RecordItem): RowDnd => ({
    className: clsx(
      dragId === r.id && 'dragging',
      over?.id === r.id && (over.after ? 'drop-after' : 'drop-before'),
    ),
    onDragStart: (e) => {
      setDragId(r.id);
      e.dataTransfer.effectAllowed = 'move';
    },
    onDragEnd: endDrag,
    onDragOver: (e) => {
      if (!dragId || dragId === r.id) return;
      e.preventDefault();
      setOver({ id: r.id, after: dropAfter(e) });
    },
    onDragLeave: () => setOver((o) => (o?.id === r.id ? null : o)),
    onDrop: (e) => {
      e.preventDefault();
      if (dragId && dragId !== r.id) reorderRecord(dragId, r.id, dropAfter(e));
      endDrag();
    },
  });

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <h1 className="page-title">
            {type.name} <InlineNotes text={type.note} />
          </h1>
          <p className="page-desc">共 {sorted.length} 条记录 · 拖动可调整顺序</p>
        </div>
        <button className="btn btn-primary" onClick={() => requestEditor({ typeId })}>
          <Plus size={15} />
          新建{type.name}
        </button>
        {!selection.selecting && !(isProject && settings?.projectViewMode === 'board') && (
          <button className="btn btn-ghost" onClick={selection.enter}>
            <ListChecks size={15} />批量选择
          </button>
        )}
      </div>

      <div className="filter-bar">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            className={`filter-chip ${statusFilter === f.key ? 'active' : ''}`}
            onClick={() => setStatusFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
        {isProject && (
          <div className="view-mode-toggle" aria-label="项目视图">
            <button
              aria-pressed={(settings?.projectViewMode ?? 'list') === 'list'}
              onClick={() => void updateSettings({ projectViewMode: 'list' })}
            >列表</button>
            <button
              aria-pressed={settings?.projectViewMode === 'board'}
              onClick={() => {
                setStatusFilter('all');
                void updateSettings({ projectViewMode: 'board' });
              }}
            >看板</button>
          </div>
        )}
      </div>

      {isProject && settings?.projectViewMode === 'board' ? (
        <Suspense fallback={<div className="board-loading">正在展开项目看板…</div>}>
          <ProjectBoard
            projects={boardProjects}
            allRecords={allRecords}
            todoTypeId={todoTypeId}
            onMove={(id, status) => void updateRecord(id, { status })}
          />
        </Suspense>
      ) : sorted.length === 0 ? (
        <Empty text={`暂无${statusFilter === 'all' ? '' : '该状态下的'}${type.name}记录`} />
      ) : isDirection ? (
        <div className="record-grid">
          {sorted.map((r) => (
            <DirectionCard key={r.id} record={r} dnd={selection.selecting ? undefined : dndFor(r)} selection={selectionFor(r)} />
          ))}
        </div>
      ) : isProject ? (
        <div>
          {subGroups.map((g) => (
            <Fragment key={g.key}>
              <h2 className="section-title proj-group">{g.label}</h2>
              <div className="record-list">
                {g.items.map((r) => (
                  <div className="project-record-wrap" key={r.id}>
                    <RecordRow record={r} dnd={selection.selecting ? undefined : dndFor(r)} selection={selectionFor(r)} />
                    <ProjectNextActions records={allRecords} projectId={r.id} todoTypeId={todoTypeId} />
                  </div>
                ))}
              </div>
            </Fragment>
          ))}
        </div>
      ) : (
        <div className="record-list">
          {sorted.map((r) => (
            <RecordRow key={r.id} record={r} dnd={selection.selecting ? undefined : dndFor(r)} selection={selectionFor(r)} />
          ))}
        </div>
      )}
      {selection.selecting && (
        <>
          <button className="select-visible-btn" onClick={selection.selectVisible}>选择当前结果（{sorted.length}）</button>
          <BulkActionBar
            count={selection.selected.size}
            workspaces={workspaces}
            onArchive={async () => {
              await updateRecords([...selection.selected], { archived: true });
              selection.clear();
            }}
            onMove={async (workspaceId) => {
              await updateRecords([...selection.selected], { workspaceId });
              selection.clear();
            }}
            onDelete={async () => {
              const count = selection.selected.size;
              const confirmed = await confirmDialog({
                message: `确定删除已选择的 ${count} 条记录吗？此操作不可恢复。`,
                confirmLabel: '删除',
                danger: true,
              });
              if (!confirmed) return;
              await deleteRecords([...selection.selected]);
              selection.clear();
            }}
            onCancel={selection.clear}
          />
        </>
      )}
    </div>
  );
}
