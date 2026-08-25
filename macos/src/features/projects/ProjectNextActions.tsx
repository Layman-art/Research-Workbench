import { ArrowRight, Plus } from 'lucide-react';
import type { RecordItem } from '../../domain/models';
import { requestEditor } from '../../editorBus';
import { selectProjectNextActions } from '../../store/selectors';

export function ProjectNextActions({
  records,
  projectId,
  todoTypeId = 'todo',
}: {
  records: RecordItem[];
  projectId: string;
  todoTypeId?: string;
}) {
  const actions = selectProjectNextActions(records, projectId);
  if (actions.length === 0) {
    return (
      <div className="project-actions-empty">
        <span>尚未设置下一步行动</span>
        <button onClick={() => requestEditor({ typeId: todoTypeId, projectId })}>
          <Plus size={12} /> 添加
        </button>
      </div>
    );
  }
  return (
    <div className="project-actions">
      <div className="project-actions-label">下一步行动</div>
      {actions.slice(0, 3).map((action) => (
        <button key={action.id} aria-label={action.title} onClick={() => requestEditor({ recordId: action.id })}>
          <ArrowRight size={12} />
          <span>{action.title}</span>
          {action.dueDate && <time>{action.dueDate}</time>}
        </button>
      ))}
      {actions.length > 3 && <span className="project-actions-more">还有 {actions.length - 3} 项</span>}
    </div>
  );
}
