import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../stores';
import { filterRecords } from '../store/selectors';
import { RecordRow } from './RecordRow';
import { InlineNotes } from './MusicNotes';
import { MoonHero } from './MoonHero';
import { ScheduleView } from './ScheduleView';
import { greeting } from '../utils';
import { useNow, useToday } from '../hooks/useToday';
import { DraftsPanel } from './DraftsPanel';
import { ProjectNextActions } from '../features/projects/ProjectNextActions';
import { requestEditor } from '../editorBus';
import './workflow.css';

export function Dashboard() {
  useNow();
  const [limit, setLimit] = useState(100);
  const today = useToday();
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
  const todoIds = new Set(types.filter((t) => t.kind === 'todo').map((t) => t.id));
  const dueToday = filtered.filter((r) => todoIds.has(r.typeId) && !r.done && r.dueDate && r.dueDate <= today);
  const recentNotes = filtered.filter((r) => !todoIds.has(r.typeId) && types.find((t) => t.id === r.typeId)?.kind === 'generic').slice(0, 5);
  const projectIds = new Set(types.filter((t) => t.kind === 'project').map((t) => t.id));
  const projects = filtered.filter((r) => projectIds.has(r.typeId) && r.status !== 'done').slice(0, 3);
  const todoTypeId = types.find((t) => t.kind === 'todo')?.id ?? '';
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
            {filtered.slice(0, limit).map((r) => (
              <RecordRow key={r.id} record={r} />
            ))}
            {filtered.length > limit && <button className="btn load-more" onClick={() => setLimit((n) => n + 100)}>再显示 100 条</button>}
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
        <p className="page-desc">今天是 {today} · 保持节奏，稳步向前。</p>
      </div>

      <DraftsPanel />

      {scheduleType && <ScheduleView typeId={scheduleType.id} embedded />}

      {dueToday.length > 0 && (
        <>
          <h2 className="section-title">提醒事项</h2>
          <div className="record-list">
            {dueToday.slice(0, 20).map((r) => (
              <RecordRow key={r.id} record={r} />
            ))}
          </div>
        </>
      )}
      {recentNotes.length > 0 && <section className="workflow-panel">
        <h2 className="section-title">最近笔记与资料</h2>
        <div className="workflow-links">{recentNotes.map((record) => <button key={record.id} className="card workflow-link" onClick={() => requestEditor({ recordId: record.id })}><strong>{record.title}</strong><span>继续阅读与编辑</span></button>)}</div>
      </section>}
      {projects.length > 0 && <section className="workflow-panel">
        <h2 className="section-title">项目下一步</h2>
        {projects.map((project) => <div className="card project-record-wrap" key={project.id}>
          <button className="btn btn-ghost" onClick={() => requestEditor({ recordId: project.id })}>{project.title}</button>
          <ProjectNextActions records={records} projectId={project.id} todoTypeId={todoTypeId} />
        </div>)}
      </section>}
      <details className="dashboard-statistics"><summary>查看记录分布与近 14 天活动</summary><MoonHero /></details>
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
