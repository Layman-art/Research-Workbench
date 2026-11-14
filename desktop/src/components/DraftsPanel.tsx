import { useEffect, useState } from 'react';
import type { Draft } from '../domain/models';
import { workbenchRepository } from '../repositories';
import { requestEditor } from '../editorBus';
import { useStore } from '../stores';
import './workflow.css';

function draftDetails(draft: Draft): { title: string; workspaceId?: string } {
  try {
    const payload = JSON.parse(draft.payload);
    return { title: typeof payload.title === 'string' && payload.title.trim() ? payload.title : '未命名草稿', workspaceId: payload.workspaceId };
  } catch { return { title: '待恢复草稿' }; }
}

type DraftPreview = Pick<Draft, 'id' | 'recordId' | 'updatedAt'> & ReturnType<typeof draftDetails>;

export function DraftsPanel() {
  const workspace = useStore((state) => state.workspaceFilter);
  const [drafts, setDrafts] = useState<DraftPreview[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void workbenchRepository.listDrafts().then((items) => {
        if (active) { setDrafts(items.map((draft) => ({ id: draft.id, recordId: draft.recordId, updatedAt: draft.updatedAt, ...draftDetails(draft) })));  setError(''); }
      }).catch(() => { if (active) setError('暂时无法读取草稿，请重新打开工作台重试。'); });
    };
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('workbench:drafts-changed', refresh);
    return () => {
      active = false;
      window.removeEventListener('focus', refresh);
      window.removeEventListener('workbench:drafts-changed', refresh);
    };
  }, []);
  const visible = drafts.filter((draft) => workspace === 'all' || draft.workspaceId === workspace);
  if (!visible.length && !error) return null;
  return <section className="workflow-panel" aria-label="待恢复草稿">
    <h2 className="section-title">继续上次编辑</h2>
    {error && <p role="alert">{error}</p>}
    <div className="workflow-links">{visible.map((draft) => <button key={draft.id} className="card workflow-link" onClick={() => requestEditor({ draftId: draft.id, recordId: draft.recordId ?? undefined })}>
      <strong>{draft.title}</strong><span>恢复草稿 · {new Date(draft.updatedAt).toLocaleString()}</span>
    </button>)}</div>
  </section>;
}
