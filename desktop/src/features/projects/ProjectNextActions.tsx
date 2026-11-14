import { useMemo, useState } from 'react';
import { useStore } from '../../stores';
import { ArrowRight, Plus } from 'lucide-react';
import type { RecordItem } from '../../domain/models';
import { requestEditor } from '../../editorBus';
import { selectProjectNextActions } from '../../store/selectors';
import { useToday } from '../../hooks/useToday';
import '../../components/workflow.css';

export function ProjectNextActions({ records, projectId, todoTypeId = 'todo' }: { records: RecordItem[]; projectId: string; todoTypeId?: string }) {
  const today = useToday();
  const types = useStore((s) => s.types);
  const todoIds = useMemo(() => new Set([todoTypeId, ...types.filter((t) => t.kind === 'todo').map((t) => t.id)]), [types, todoTypeId]);
  const [limit, setLimit] = useState(50);
  const actions = useMemo(() => selectProjectNextActions(records, projectId, today).filter((record) => todoIds.has(record.typeId)), [records, projectId, today, todoIds]);
  const linked = useMemo(() => records.filter((record) => record.projectId === projectId && !todoIds.has(record.typeId) && !record.deletedAt && !record.archived), [records, projectId, todoIds]);
  return <>
    {actions.length === 0 ? <div className="project-actions-empty">
      <span>尚未设置下一步行动</span>
      <button onClick={() => requestEditor({ typeId: todoTypeId, projectId })}><Plus size={12} /> 添加</button>
    </div> : <div className="project-actions">
      <div className="project-actions-label">下一步行动</div>
      {actions.slice(0, 3).map((action) => <button key={action.id} aria-label={action.title} onClick={() => requestEditor({ recordId: action.id })}>
        <ArrowRight size={12} /><span>{action.title}</span>{action.dueDate && <time>{action.dueDate}</time>}
      </button>)}
      {actions.length > 3 && <span className="project-actions-more">还有 {actions.length - 3} 项</span>}
    </div>}
    {linked.length > 0 && <details className="project-linked-records"><summary>关联笔记、日程与资料（{linked.length}）</summary>
      {linked.slice(0, limit).map((record) => <button key={record.id} onClick={() => requestEditor({ recordId: record.id })}>{record.title}</button>)}
      {linked.length > limit && <button onClick={() => setLimit((n) => n + 50)}>再显示 50 条</button>}
    </details>}
  </>;
}
