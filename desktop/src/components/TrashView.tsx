import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../stores';
import { confirmDialog } from '../confirmBus';
import { useToday } from '../hooks/useToday';
import { formatDate } from '../utils';
import './workflow.css';

export function TrashView() {
  const { records, workspaceFilter, restoreRecords, permanentlyDeleteRecords } = useStore(useShallow((s) => ({ records: s.records, workspaceFilter: s.workspaceFilter, restoreRecords: s.restoreRecords, permanentlyDeleteRecords: s.permanentlyDeleteRecords })));
  const today = useToday();
  const [limit, setLimit] = useState(100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const deleted = useMemo(() => records.filter((r) => r.deletedAt && (workspaceFilter === 'all' || r.workspaceId === workspaceFilter)).sort((a, b) => b.deletedAt! - a.deletedAt!), [records, workspaceFilter]);
  const act = async (id: string, permanent = false) => {
    if (busy) return;
    if (permanent && !await confirmDialog({ message: '永久删除后无法从回收站恢复。确定继续？', confirmLabel: '永久删除', danger: true })) return;
    setBusy(true); setError('');
    try { if (permanent) await permanentlyDeleteRecords([id]); else await restoreRecords([id]); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };
  return <div>
    <div className="page-head"><h1 className="page-title">回收站</h1><p className="page-desc">删除的记录保留 30 天。恢复保留原有内容与工作区；永久删除不可撤销。</p></div>
    {error && <p role="alert">{error}</p>}
    {!deleted.length && <p className="empty">当前工作区没有已删除的记录。</p>}
    <div className="record-list">{deleted.slice(0, limit).map((r) => <article className="card workflow-link" key={r.id}>
      <strong>{r.title}</strong><span>删除于 {formatDate(r.deletedAt!)} · {today >= formatDate(r.deletedAt! + 30 * 86_400_000) ? '已到清理期限' : `保留至 ${formatDate(r.deletedAt! + 30 * 86_400_000)}`}</span>
      <div className="workflow-actions"><button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void act(r.id)}>恢复</button><button className="btn btn-ghost btn-sm btn-danger" disabled={busy} onClick={() => void act(r.id, true)}>永久删除</button></div>
    </article>)}</div>
    {deleted.length > limit && <button className="btn load-more" onClick={() => setLimit((n) => n + 100)}>再显示 100 条</button>}
  </div>;
}
