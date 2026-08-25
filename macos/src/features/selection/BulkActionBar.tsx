import { Archive, Trash2, X } from 'lucide-react';
import type { Workspace } from '../../domain/models';

export function BulkActionBar({
  count,
  workspaces,
  onArchive,
  onMove,
  onDelete,
  onCancel,
}: {
  count: number;
  workspaces: Workspace[];
  onArchive: () => void | Promise<void>;
  onMove: (workspaceId: string) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  onCancel: () => void;
}) {
  return (
    <div className="bulk-action-bar" role="toolbar" aria-label="批量操作">
      <strong>已选择 {count} 条</strong>
      <button className="btn btn-ghost btn-sm" disabled={!count} onClick={() => void onArchive()}>
        <Archive size={13} />归档
      </button>
      <label>
        <span>移动到</span>
        <select
          className="form-select"
          aria-label="移动到工作区"
          disabled={!count}
          defaultValue=""
          onChange={(event) => {
            if (event.target.value) void onMove(event.target.value);
            event.target.value = '';
          }}
        >
          <option value="" disabled>选择工作区</option>
          {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
        </select>
      </label>
      <button className="btn btn-ghost btn-danger btn-sm" disabled={!count} onClick={() => void onDelete()}>
        <Trash2 size={13} />删除
      </button>
      <button className="icon-btn" aria-label="退出批量选择" onClick={onCancel}><X size={15} /></button>
    </div>
  );
}
