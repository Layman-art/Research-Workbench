import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Plus, Star, Trash2, Calendar, ListChecks } from 'lucide-react';
import { useStore } from '../stores';
import { filterRecords } from '../store/selectors';
import type { RecordItem } from '../types';
import { InlineNotes } from './MusicNotes';
import { Empty } from './Dashboard';
import { requestEditor } from '../editorBus';
import { confirmDialog } from '../confirmBus';
import { daysFromToday, formatDate, todayStr } from '../utils';
import { markdownSummary } from '../features/markdown/plainText';
import clsx from 'clsx';
import { useRecordSelection } from '../features/selection/useRecordSelection';
import { BulkActionBar } from '../features/selection/BulkActionBar';

type Tab = 'today' | 'plan' | 'archive';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'today', label: '今天' },
  { key: 'plan', label: '计划' },
  { key: 'archive', label: '档案' },
];

function daysUntilSunday(): number {
  return 6 - ((new Date().getDay() + 6) % 7);
}

function DueBadge({ dueDate }: { dueDate: string }) {
  const diff = daysFromToday(dueDate);
  const label = diff < 0 ? `已过期 ${-diff} 天` : diff === 0 ? '今天' : diff === 1 ? '明天' : dueDate;
  return (
    <span className={clsx('due-badge', diff < 0 && 'overdue', diff === 0 && 'today')}>
      <Calendar size={12} />
      {label}
    </span>
  );
}

function monthHeading(ts: number): string {
  const d = new Date(ts);
  return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月';
}

export function TodoItem({
  record,
  projectTitle,
  selection,
}: {
  record: RecordItem;
  projectTitle?: string;
  selection?: { checked: boolean; onToggle: () => void };
}) {
  const { toggleDone, toggleStar, deleteRecord, updateRecord } = useStore(
    useShallow((state) => ({
      toggleDone: state.toggleDone,
      toggleStar: state.toggleStar,
      deleteRecord: state.deleteRecord,
      updateRecord: state.updateRecord,
    })),
  );
  const [isCompleting, setIsCompleting] = useState(false);
  const summary = record.content ? markdownSummary(record.content, 80) : '';
  const setDue = (dueDate: string | null) => { void updateRecord(record.id, { dueDate }); };
  const toggleCompletion = () => {
    if (record.done || document.documentElement.dataset.motion === 'reduce') {
      void toggleDone(record.id);
      return;
    }
    if (isCompleting) return;
    setIsCompleting(true);
    window.setTimeout(() => {
      void toggleDone(record.id).finally(() => setIsCompleting(false));
    }, 180);
  };
  return (
    <div className={clsx('card', 'todo-item', record.done && 'done', isCompleting && 'is-completing')}>
      {selection ? (
        <input className="record-select" type="checkbox" aria-label={`选择「${record.title}」`} checked={selection.checked} onChange={selection.onToggle} />
      ) : (
        <button className="check" onClick={toggleCompletion} disabled={isCompleting} aria-label={record.done ? '标记为未完成' : '标记为完成'}>✓</button>
      )}
      <div className="record-main">
        <div className="record-title" onClick={() => requestEditor({ recordId: record.id })} role="button" tabIndex={0}>
          {record.title}
        </div>
        {(summary || projectTitle) && (
          <div className="todo-item-extra">
            {projectTitle && <span className="todo-project-chip">{projectTitle}</span>}
            {summary && <span className="todo-item-summary">{summary}</span>}
          </div>
        )}
        <div className="record-meta">
          {record.priority !== 'none' && (
            <span className={`priority-flag priority-${record.priority}`}>
              {record.priority === 'high' ? '高优先级' : record.priority === 'medium' ? '中优先级' : '低优先级'}
            </span>
          )}
          {record.dueDate && <DueBadge dueDate={record.dueDate} />}
          {!record.done && (
            <span className="todo-due-shortcuts">
              <button type="button" onClick={() => setDue(todayStr())}>今天</button>
              <button type="button" onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() + 1);
                setDue(formatDate(d.getTime()));
              }}>明天</button>
              <button type="button" onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() + daysUntilSunday());
                setDue(formatDate(d.getTime()));
              }}>本周</button>
              {record.dueDate && <button type="button" onClick={() => setDue(null)}>清除日期</button>}
            </span>
          )}
        </div>
      </div>
      <div className="record-actions">
        <button className={clsx('star-btn', record.starred && 'on')} title={record.starred ? '移出重要' : '标为重要'} onClick={() => toggleStar(record.id)}>
          <Star size={15} fill={record.starred ? 'currentColor' : 'none'} />
        </button>
        <button className="icon-btn danger" title="删除" onClick={() => {
          void confirmDialog({
            message: `确定删除「${record.title}」吗？`,
            confirmLabel: '删除',
            danger: true,
          }).then((confirmed) => {
            if (confirmed) void deleteRecord(record.id);
          });
        }}>
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

export function TodoView({ typeId }: { typeId: string }) {
  const {
    records, types, workspaceFilter, search, statusFilter, addRecord, clearDone,
    workspaces, updateRecords, deleteRecords,
  } = useStore(
    useShallow((state) => ({
      records: state.records, types: state.types, workspaceFilter: state.workspaceFilter,
      search: state.search, statusFilter: state.statusFilter, addRecord: state.addRecord,
      clearDone: state.clearDone, workspaces: state.workspaces,
      updateRecords: state.updateRecords, deleteRecords: state.deleteRecords,
    })),
  );
  const [tab, setTab] = useState<Tab>('today');
  const [starredOnly, setStarredOnly] = useState(false);
  const [quick, setQuick] = useState('');

  const all = useMemo(
    () => filterRecords({ records, typeId, workspaceId: workspaceFilter, status: statusFilter, query: search }),
    [records, search, statusFilter, typeId, workspaceFilter],
  );
  const type = types.find((t) => t.id === typeId);
  const projectTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of records) if (r.typeId === 'project') map.set(r.id, r.title);
    return map;
  }, [records]);

  const today = todayStr();
  const untilSunday = daysUntilSunday();
  const groups = useMemo<Record<string, RecordItem[]>>(() => {
    const scoped = starredOnly ? all.filter((r) => r.starred) : all;
    const active = scoped.filter((r) => !r.done);
    const done = scoped.filter((r) => r.done);
    const dueIn = (r: RecordItem) => (r.dueDate ? daysFromToday(r.dueDate) : null);
    const result: Record<string, RecordItem[]> = {};
    if (tab === 'today') {
      result['已过期'] = active.filter((r) => dueIn(r) !== null && dueIn(r)! < 0);
      result['今天'] = active.filter((r) => dueIn(r) === 0);
      result['本周'] = active.filter((r) => dueIn(r) !== null && dueIn(r)! > 0 && dueIn(r)! <= untilSunday);
    } else if (tab === 'plan') {
      result['更晚'] = active.filter((r) => dueIn(r) !== null && dueIn(r)! > untilSunday);
    } else {
      result['无日期'] = active.filter((r) => dueIn(r) === null);
      const byMonth = new Map<string, RecordItem[]>();
      for (const r of done) {
        const key = monthHeading(r.updatedAt);
        const list = byMonth.get(key) ?? [];
        list.push(r);
        byMonth.set(key, list);
      }
      for (const [label, items] of byMonth) result['已完成 · ' + label] = items;
    }
    return result;
  }, [all, starredOnly, tab, untilSunday]);

  const counts: Record<Tab, number> = useMemo(() => {
    const scoped = starredOnly ? all.filter((r) => r.starred) : all;
    const active = scoped.filter((r) => !r.done);
    const dueIn = (r: RecordItem) => (r.dueDate ? daysFromToday(r.dueDate) : null);
    return {
      today: active.filter((r) => dueIn(r) !== null && dueIn(r)! <= untilSunday).length,
      plan: active.filter((r) => dueIn(r) !== null && dueIn(r)! > untilSunday).length,
      archive: active.filter((r) => dueIn(r) === null).length + scoped.filter((r) => r.done).length,
    };
  }, [all, starredOnly, untilSunday]);
  const visible = useMemo(() => Object.values(groups).flat(), [groups]);
  const selection = useRecordSelection(visible.map((record) => record.id));

  if (!type) return null;

  const submitQuick = () => {
    const title = quick.trim();
    if (!title) return;
    addRecord({
      typeId,
      title,
      dueDate: tab === 'today' ? today : null,
    });
    setQuick('');
  };

  const isEmpty = Object.values(groups).every((g) => g.length === 0);
  const doneTotal = records.filter((r) => r.typeId === typeId && r.done && !r.archived).length;
  const clearAll = async () => {
    const confirmed = await confirmDialog({
      message: `确定删除全部 ${doneTotal} 条已完成待办吗？此操作不可恢复。`,
      confirmLabel: '清空',
      danger: true,
    });
    if (confirmed) clearDone(typeId);
  };

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
        <div style={{ flex: 1 }}>
          <h1 className="page-title">{type.name} <InlineNotes text={type.note} /></h1>
          <p className="page-desc">打开就是今天该做的事；计划和档案按需再看。</p>
        </div>
        {!selection.selecting && <button className="btn btn-ghost" onClick={selection.enter}><ListChecks size={15} />批量选择</button>}
      </div>

      <div className="card todo-quick-add">
        <Plus size={17} className="plus" />
        <input
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitQuick()}
          placeholder={tab === 'today' ? '添加今天要做的事，回车创建' : '添加待办，回车创建'}
        />
        <button className="btn btn-primary btn-sm" onClick={submitQuick}>添加</button>
      </div>

      <div className="todo-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={clsx('todo-tab', tab === t.key && 'active')} onClick={() => setTab(t.key)}>
            {t.label}<span className="count">{counts[t.key]}</span>
          </button>
        ))}
        <button className={clsx('todo-tab', starredOnly && 'active')} onClick={() => setStarredOnly((v) => !v)} aria-pressed={starredOnly}>
          只看重要
        </button>
      </div>

      {isEmpty ? (
        <Empty text={tab === 'today' ? '今天没有待办，轻装上阵' : '这个分组空空如也'} />
      ) : (
        Object.entries(groups).map(([label, items]) => items.length > 0 && (
          <div key={label}>
            <div className="todo-group-label">
              <span>{label}</span>
              {label.startsWith('已完成') && (
                <button className="clear-done-btn" onClick={clearAll}>清空已完成</button>
              )}
            </div>
            <div className="record-list">
              {items.map((r) => (
                <TodoItem
                  key={r.id}
                  record={r}
                  projectTitle={r.projectId ? projectTitleById.get(r.projectId) : undefined}
                  selection={selection.selecting ? { checked: selection.selected.has(r.id), onToggle: () => selection.toggle(r.id) } : undefined}
                />
              ))}
            </div>
          </div>
        ))
      )}
      {selection.selecting && (
        <>
          <button className="select-visible-btn" onClick={selection.selectVisible}>选择当前结果（{visible.length}）</button>
          <BulkActionBar
            count={selection.selected.size}
            workspaces={workspaces}
            onArchive={async () => { await updateRecords([...selection.selected], { archived: true }); selection.clear(); }}
            onMove={async (workspaceId) => { await updateRecords([...selection.selected], { workspaceId }); selection.clear(); }}
            onDelete={async () => {
              const count = selection.selected.size;
              const confirmed = await confirmDialog({
                message: `确定删除已选择的 ${count} 条待办吗？`,
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
