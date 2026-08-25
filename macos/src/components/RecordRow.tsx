import { Star, Pencil, Copy, Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { DragEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { RecordItem } from '../types';
import { STATUS_LABEL, SUB_LABEL } from '../types';
import { useStore } from '../stores';
import { requestEditor } from '../editorBus';
import { confirmDialog } from '../confirmBus';
import { formatDate } from '../utils';
import { markdownToPlainLines } from '../features/markdown/plainText';
import { LiteratureMeta } from '../features/literature/LiteratureMeta';
import { desktopPlatform } from '../platform';

/** 拖拽排序的透传属性（类型页行列表用；不传则不可拖拽，行为与之前一致） */
export interface RowDnd {
  className: string;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
}

export function StatusPill({ status }: { status: RecordItem['status'] }) {
  return <span className={`pill pill-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function StarButton({ record }: { record: RecordItem }) {
  const toggleStar = useStore((s) => s.toggleStar);
  return (
    <button
      className={`star-btn ${record.starred ? 'on' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        toggleStar(record.id);
      }}
      title={record.starred ? '移出今日重点' : '设为今日重点'}
    >
      <Star size={16} fill={record.starred ? 'currentColor' : 'none'} />
    </button>
  );
}

export function RecordRow({
  record,
  dnd,
  selection,
}: {
  record: RecordItem;
  dnd?: RowDnd;
  selection?: { checked: boolean; onToggle: () => void };
}) {
  const { types, workspaces, archiveRecord, duplicateRecord, deleteRecord } = useStore(
    useShallow((state) => ({
      types: state.types,
      workspaces: state.workspaces,
      archiveRecord: state.archiveRecord,
      duplicateRecord: state.duplicateRecord,
      deleteRecord: state.deleteRecord,
    })),
  );
  const type = types.find((t) => t.id === record.typeId);
  const ws = workspaces.find((w) => w.id === record.workspaceId);

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
      className={clsx('card record-row', record.archived && 'archived', dnd?.className)}
      draggable={!!dnd}
      onDragStart={dnd?.onDragStart}
      onDragEnd={dnd?.onDragEnd}
      onDragOver={dnd?.onDragOver}
      onDragLeave={dnd?.onDragLeave}
      onDrop={dnd?.onDrop}
      title={dnd ? '拖动可调整顺序' : undefined}
    >
      {selection && (
        <input
          className="record-select"
          type="checkbox"
          aria-label={`选择「${record.title}」`}
          checked={selection.checked}
          onChange={selection.onToggle}
        />
      )}
      <StarButton record={record} />
      <div className="record-main">
        <div
          className="record-title"
          onClick={() => requestEditor({ recordId: record.id })}
          role="button"
          tabIndex={0}
        >
          {record.title}
        </div>
        {record.literature && (
          <LiteratureMeta
            details={record.literature}
            onOpenExternal={(url) => desktopPlatform.openExternal(url)}
          />
        )}
        {record.content && (
          <div className="record-snippet" title={record.content}>
            {markdownToPlainLines(record.content)}
          </div>
        )}
        <div className="record-meta">
          {record.archived ? <span className="pill pill-archived">已归档</span> : <StatusPill status={record.status} />}
          {type && (
            <span>
              {type.name}
              {record.sub ? ` · ${SUB_LABEL[record.sub]}` : ''}
            </span>
          )}
          {ws && <span>· {ws.name}</span>}
          {record.fields.map((f) => (
            <span key={f.id} className="field-chip">
              <b>{f.name}</b>
              {f.value}
            </span>
          ))}
          <span style={{ marginLeft: 'auto' }}>更新于 {formatDate(record.updatedAt)}</span>
        </div>
      </div>
      <div className="record-actions">
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
          {record.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
        </button>
        <button className="icon-btn danger" title="删除" onClick={onDelete}>
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
