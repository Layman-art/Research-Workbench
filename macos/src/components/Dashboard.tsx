import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../stores';
import { filterRecords } from '../store/selectors';
import { RecordRow } from './RecordRow';
import { InlineNotes } from './MusicNotes';
import { MoonHero } from './MoonHero';
import { ScheduleView } from './ScheduleView';
import { greeting, todayStr, daysFromToday } from '../utils';

export function Dashboard() {
  const { records, types, workspaceFilter, search, statusFilter, displayName } = useStore(
    useShallow((state) => ({
      records: state.records,
      types: state.types,
      workspaceFilter: state.workspaceFilter,
      search: state.search,
      statusFilter: state.statusFilter,
      displayName: state.displayName,
    })),
  );

  const filtered = useMemo(
    () =>
      filterRecords({
        records,
        workspaceId: workspaceFilter,
        status: statusFilter,
        query: search,
      }),
    [records, search, statusFilter, workspaceFilter],
  );
  const todoType = types.find((t) => t.kind === 'todo');
  const dueToday = todoType
    ? filtered.filter(
        (r) => r.typeId === todoType.id && !r.done && r.dueDate && daysFromToday(r.dueDate) <= 0,
      )
    : [];
  const scheduleType = types.find((t) => t.kind === 'schedule');

  if (statusFilter === 'archived') {
    return (
      <div>
        <div className="page-head">
          <h1 className="page-title">已归档</h1>
          <p className="page-desc">归档的记录不参与日常筛选，可随时恢复。</p>
        </div>
        {filtered.length === 0 ? (
          <Empty text="暂无归档记录" />
        ) : (
          <div className="record-list">
            {filtered.map((r) => (
              <RecordRow key={r.id} record={r} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">
          {greeting()}
          {displayName ? `，${displayName}` : ''} <InlineNotes text="♪ 𝄞 ♫" />
        </h1>
        <p className="page-desc">今天是 {todayStr()} · 保持节奏，稳步向前。</p>
      </div>

      <MoonHero />

      {scheduleType && <ScheduleView typeId={scheduleType.id} embedded />}

      {dueToday.length > 0 && (
        <>
          <h2 className="section-title">提醒事项</h2>
          <div className="record-list">
            {dueToday.map((r) => (
              <RecordRow key={r.id} record={r} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <div className="notes">♪ ♫ ♩</div>
      <div className="serif">{text}</div>
      <div>安静地等待第一段旋律。</div>
    </div>
  );
}
