import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { LayoutGrid, Settings, Plus, Archive } from 'lucide-react';
import { useStore } from '../stores';
import { countRecordsByType } from '../store/selectors';
import { typeIcon } from '../icons';
import { FloatingNotes } from './MusicNotes';
import { requestEditor } from '../editorBus';
import clsx from 'clsx';

export function Sidebar() {
  const { types, records, view, setView, setStatusFilter, reorderType } = useStore(
    useShallow((state) => ({
      types: state.types,
      records: state.records,
      view: state.view,
      setView: state.setView,
      setStatusFilter: state.setStatusFilter,
      reorderType: state.reorderType,
    })),
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; after: boolean } | null>(null);

  const counts = useMemo(() => countRecordsByType(records, types), [records, types]);
  const scheduleType = types.find((type) => type.kind === 'schedule');

  const archivedCount = records.filter((r) => r.archived).length;

  const go = (v: string) => {
    setStatusFilter('all');
    setView(v);
  };

  const endDrag = () => {
    setDragId(null);
    setOver(null);
  };

  return (
    <aside className="sidebar">
      <nav className="nav">
        <div className="nav-section">概览</div>
        <button className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => go('dashboard')}>
          <LayoutGrid size={16} />
          <span>工作台总览</span>
        </button>
        {scheduleType && (() => {
          const ScheduleIcon = typeIcon(scheduleType.icon);
          return (
            <button
              className={clsx('nav-item', view === scheduleType.id && 'active')}
              onClick={() => go(scheduleType.id)}
              title="打开日程安排"
            >
              <ScheduleIcon size={16} />
              <span>{scheduleType.name}</span>
              <span className="nav-note" aria-hidden>{scheduleType.note}</span>
              <span className="count">{counts[scheduleType.id]}</span>
            </button>
          );
        })()}

        <div className="nav-section">内容类型</div>
        {types
          .filter((t) => t.kind !== 'schedule')
          .map((t) => {
          const Icon = typeIcon(t.icon);
          return (
            <button
              key={t.id}
              className={clsx(
                'nav-item',
                view === t.id && 'active',
                dragId === t.id && 'dragging',
                over?.id === t.id && (over.after ? 'drop-after' : 'drop-before'),
              )}
              onClick={() => go(t.id)}
              draggable
              onDragStart={(e) => {
                setDragId(t.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={endDrag}
              onDragOver={(e) => {
                if (!dragId || dragId === t.id) return;
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                setOver({ id: t.id, after: e.clientY > rect.top + rect.height / 2 });
              }}
              onDragLeave={() => setOver((o) => (o?.id === t.id ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId && dragId !== t.id) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  reorderType(dragId, t.id, e.clientY > rect.top + rect.height / 2);
                }
                endDrag();
              }}
              title={`${t.name}（拖动可调整顺序）`}
            >
              <Icon size={16} />
              <span>{t.name}</span>
              <span className="nav-note" aria-hidden>
                {t.note}
              </span>
              <span className="count">{counts[t.id]}</span>
            </button>
          );
        })}

        <div className="nav-section nav-other">其他</div>
        <button
          className={`nav-item ${view === 'archive' ? 'active' : ''}`}
          onClick={() => {
            setView('dashboard');
            setStatusFilter('archived');
          }}
        >
          <Archive size={16} />
          <span>已归档</span>
          <span className="count">{archivedCount}</span>
        </button>
        <button className={`nav-item ${view === 'settings' ? 'active' : ''}`} onClick={() => go('settings')}>
          <Settings size={16} />
          <span>设置与数据</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <FloatingNotes count={6} />
        <button className="nav-item" onClick={() => requestEditor({})}>
          <Plus size={16} />
          <span>新建记录</span>
        </button>
      </div>
    </aside>
  );
}
