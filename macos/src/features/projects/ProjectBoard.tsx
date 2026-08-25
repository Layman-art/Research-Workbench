import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { RecordItem, Status } from '../../domain/models';
import { STATUS_LABEL, SUB_LABEL } from '../../types';
import { requestEditor } from '../../editorBus';
import { ProjectNextActions } from './ProjectNextActions';

const STATUSES = Object.keys(STATUS_LABEL) as Status[];

function ProjectCard({
  project,
  allRecords,
  todoTypeId,
  onMove,
}: {
  project: RecordItem;
  allRecords: RecordItem[];
  todoTypeId: string;
  onMove: (id: string, status: Status) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: project.id });
  return (
    <article
      ref={setNodeRef}
      className={`project-board-card${isDragging ? ' dragging' : ''}`}
      style={{ transform: CSS.Translate.toString(transform) }}
    >
      <div className="project-board-card-head">
        <button className="board-grip" aria-label={`拖动「${project.title}」`} {...listeners} {...attributes}>
          <GripVertical size={14} />
        </button>
        <button className="project-board-title" onClick={() => requestEditor({ recordId: project.id })}>
          {project.title}
        </button>
      </div>
      <div className="project-board-meta">
        <span>{project.sub ? SUB_LABEL[project.sub] : '未分类'}</span>
        <select
          aria-label={`移动「${project.title}」到状态`}
          value={project.status}
          onChange={(event) => onMove(project.id, event.target.value as Status)}
        >
          {STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
        </select>
      </div>
      <ProjectNextActions records={allRecords} projectId={project.id} todoTypeId={todoTypeId} />
    </article>
  );
}

function ProjectColumn({
  status,
  projects,
  allRecords,
  todoTypeId,
  onMove,
}: {
  status: Status;
  projects: RecordItem[];
  allRecords: RecordItem[];
  todoTypeId: string;
  onMove: (id: string, status: Status) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status}` });
  return (
    <section
      ref={setNodeRef}
      className={`project-column${isOver ? ' is-over' : ''}`}
      role="region"
      aria-label={`${STATUS_LABEL[status]}项目`}
    >
      <h2><span>{STATUS_LABEL[status]}</span><b>{projects.length}</b></h2>
      <div className="project-column-body">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            allRecords={allRecords}
            todoTypeId={todoTypeId}
            onMove={onMove}
          />
        ))}
        {projects.length === 0 && <div className="project-column-empty">拖到这里</div>}
      </div>
    </section>
  );
}

export function ProjectBoard({
  projects,
  allRecords,
  todoTypeId,
  onMove,
}: {
  projects: RecordItem[];
  allRecords: RecordItem[];
  todoTypeId: string;
  onMove: (id: string, status: Status) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const dragEnd = (event: DragEndEvent) => {
    const overId = String(event.over?.id ?? '');
    if (!overId.startsWith('column:')) return;
    const status = overId.slice('column:'.length) as Status;
    const project = projects.find((item) => item.id === event.active.id);
    if (project && project.status !== status) onMove(project.id, status);
  };
  return (
    <DndContext sensors={sensors} onDragEnd={dragEnd}>
      <div className="project-board">
        {STATUSES.map((status) => (
          <ProjectColumn
            key={status}
            status={status}
            projects={projects.filter((project) => project.status === status)}
            allRecords={allRecords}
            todoTypeId={todoTypeId}
            onMove={onMove}
          />
        ))}
      </div>
    </DndContext>
  );
}
