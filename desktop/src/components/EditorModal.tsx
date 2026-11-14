import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { FilePlus2, FolderPlus, Maximize2, Minimize2, Plus, Star, Trash2 } from 'lucide-react';
import { useStore, uid } from '../stores';
import { Modal } from './Modal';
import type { CustomField, LiteratureDetails, Priority, RecurrenceRule, Status } from '../types';
import { PRIORITY_LABEL, STATUS_LABEL } from '../types';
import { RECORD_SAVED_EVENT, type EditorRequest } from '../editorBus';
import type { FileReference } from '../domain/models';
import '../features/drafts/editor.css';
import { confirmDialog } from '../confirmBus';
import { todayStr } from '../utils';
import { MarkdownEditor } from '../features/markdown/MarkdownEditor';
import { desktopPlatform } from '../platform';
import { useRecordDraft } from '../features/drafts/useRecordDraft';
import { registerDraftHandler } from '../features/drafts/draftLifecycle';
import { workbenchRepository } from '../repositories';
import { RecurrenceFields } from '../features/todos/RecurrenceFields';
import { LiteratureFields } from '../features/literature/LiteratureFields';

interface EditorDraftData {
  title: string;
  typeId: string;
  workspaceId: string;
  status: Status;
  starred: boolean;
  content: string;
  fields: CustomField[];
  priority: Priority;
  dueDate: string;
  planDate: string;
  planStart: string;
  planEnd: string;
  sub: 'vertical' | 'horizontal';
  recurrence: RecurrenceRule | null;
  projectId: string;
  literature: LiteratureDetails;
  attachments: FileReference[];
}

export function EditorModal({ request, onClose }: { request: EditorRequest; onClose: () => void }) {
  const { records, types, workspaces, workspaceFilter, addRecord, updateRecord, deleteRecord } = useStore(
    useShallow((state) => ({
      records: state.records,
      types: state.types,
      workspaces: state.workspaces,
      workspaceFilter: state.workspaceFilter,
      addRecord: state.addRecord,
      updateRecord: state.updateRecord,
      deleteRecord: state.deleteRecord,
    })),
  );
  const requestedRecordId = request.recordId ?? (request.draftId?.startsWith('new:') ? request.draftId.slice(4) : undefined);
  const existing = requestedRecordId ? records.find((record) => record.id === requestedRecordId && !record.deletedAt) : undefined;

  const requestedProject = records.find((record) => record.id === request.projectId);
  const defaultWorkspaceId = existing?.workspaceId ?? requestedProject?.workspaceId ?? request.workspaceId
    ?? (workspaceFilter !== 'all' ? workspaceFilter : workspaces[0]?.id ?? '');
  const sessionRecordId = useRef(existing?.id ?? (request.draftId?.startsWith('new:') ? request.draftId.slice(4) : uid())).current;
  const originalRecordId = useRef(existing?.id ?? null).current;
  const committedId = useRef<string | null>(existing?.id ?? null);
  const savingLock = useRef(false);
  const pendingSave = useRef<Promise<void>>(Promise.resolve());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [attachments, setAttachments] = useState<FileReference[]>(existing?.attachments ?? []);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [typeId, setTypeId] = useState(existing?.typeId ?? request.typeId ?? types[0]?.id ?? '');
  const [workspaceId, setWorkspaceId] = useState(defaultWorkspaceId);
  const [status, setStatus] = useState<Status>(existing?.status ?? 'active');
  const [starred, setStarred] = useState(existing?.starred ?? false);
  const [content, setContent] = useState(existing?.content ?? '');
  const [fields, setFields] = useState<CustomField[]>(existing?.fields ?? []);
  const [priority, setPriority] = useState<Priority>(existing?.priority ?? 'none');
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? '');
  const [planDate, setPlanDate] = useState(existing?.planDate ?? request.planDate ?? todayStr());
  const [planStart, setPlanStart] = useState(existing?.planStart ?? '');
  const [planEnd, setPlanEnd] = useState(existing?.planEnd ?? '');
  const [sub, setSub] = useState<'vertical' | 'horizontal'>(existing?.sub ?? 'vertical');
  const [recurrence, setRecurrence] = useState<RecurrenceRule | null>(existing?.recurrence ?? null);
  const [projectId, setProjectId] = useState(existing?.projectId ?? request.projectId ?? '');
  const [literature, setLiterature] = useState<LiteratureDetails>(existing?.literature ?? {
    authors: '', year: null, doi: '', url: '', readingStatus: 'unread',
  });
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);

  const initialPayload = useRef(
    JSON.stringify({
      title: existing?.title ?? '',
      typeId: existing?.typeId ?? request.typeId ?? types[0]?.id ?? '',
      workspaceId: defaultWorkspaceId,
      status: existing?.status ?? 'active',
      starred: existing?.starred ?? false,
      content: existing?.content ?? '',
      fields: existing?.fields ?? [],
      priority: existing?.priority ?? 'none',
      dueDate: existing?.dueDate ?? '',
      planDate: existing?.planDate ?? request.planDate ?? todayStr(),
      planStart: existing?.planStart ?? '',
      planEnd: existing?.planEnd ?? '',
      sub: existing?.sub ?? 'vertical',
      recurrence: existing?.recurrence ?? null,
      projectId: existing?.projectId ?? request.projectId ?? '',
      literature: existing?.literature ?? { authors: '', year: null, doi: '', url: '', readingStatus: 'unread' },
      attachments: existing?.attachments ?? [],
    } satisfies EditorDraftData),
  ).current;
  const [savedPayload, setSavedPayload] = useState(initialPayload);
  const draftId = useRef(request.draftId ?? (existing ? `record:${existing.id}` : `new:${sessionRecordId}`)).current;
  const payload = useMemo(
    () =>
      JSON.stringify({
        title,
        typeId,
        workspaceId,
        status,
        starred,
        content,
        fields,
        priority,
        dueDate,
        planDate,
        planStart,
        planEnd,
        sub,
        recurrence,
        projectId,
        literature,
        attachments,
      } satisfies EditorDraftData),
    [attachments, content, dueDate, fields, literature, planDate, planEnd, planStart, priority, projectId, recurrence, starred, status, sub, title, typeId, workspaceId],
  );
  const draft = useRecordDraft({
    draftId,
    recordId: originalRecordId,
    initialPayload,
    payload,
    repository: workbenchRepository,
  });

  const selectedType = types.find((type) => type.id === typeId);
  const kind = selectedType?.id === 'literature' ? 'literature' : (selectedType?.kind ?? 'generic');
  const projectTypeIds = new Set(types.filter((type) => type.kind === 'project').map((type) => type.id));
  const availableProjects = records.filter(
    (record) => projectTypeIds.has(record.typeId) && !record.archived && !record.deletedAt && record.workspaceId === workspaceId,
  );

  // 弹窗打开后显式聚焦标题输入框（无边框窗口下 autoFocus 偶发失效）
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => titleRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  const setField = (id: string, patch: Partial<CustomField>) =>
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const restoreDraft = () => {
    if (!draft.recoveredPayload) return;
    try {
      const restored = JSON.parse(draft.recoveredPayload) as EditorDraftData;
      if (!restored || typeof restored.title !== 'string' || typeof restored.content !== 'string'
        || typeof restored.typeId !== 'string' || typeof restored.workspaceId !== 'string'
        || !Array.isArray(restored.fields)) throw new Error('无效草稿');
      setTitle(restored.title);
      setTypeId(restored.typeId);
      setWorkspaceId(restored.workspaceId);
      setStatus(restored.status);
      setStarred(restored.starred);
      setContent(restored.content);
      setFields(restored.fields);
      setPriority(restored.priority);
      setDueDate(restored.dueDate);
      setPlanDate(restored.planDate);
      setPlanStart(restored.planStart);
      setPlanEnd(restored.planEnd);
      setSub(restored.sub);
      setRecurrence(restored.recurrence ?? null);
      setProjectId(restored.projectId ?? '');
      setLiterature(restored.literature ?? { authors: '', year: null, doi: '', url: '', readingStatus: 'unread' });
      setAttachments(restored.attachments ?? []);
      draft.clearRecovered();
    } catch {
      setSaveError('草稿格式无法读取；原草稿已保留，请导出数据后检查。');
    }
  };

  const requestClose = () => {
    if (savingLock.current) return false;
    if (payload === savedPayload) return true;
    setShowDiscardPrompt(true);
    return false;
  };

  const cancel = () => {
    if (requestClose()) onClose();
  };

  const discardAndClose = async () => {
    try {
      await draft.discard();
      onClose();
    } catch (error) {
      setSaveError(`无法删除草稿：${String(error)}`);
    }
  };

  const keepDraftAndClose = async () => {
    try {
      await draft.flush();
      onClose();
    } catch (error) {
      setSaveError(`草稿未保存，请继续编辑或另存文本：${String(error)}`);
    }
  };

  const save = () => {
    if (savingLock.current || draft.loading || draft.loadFailed || draft.recoveredPayload) return;
    setSaveError(null);
    const trimmed = title.trim();
    if (!trimmed) { setSaveError('请填写标题；正文仍会自动保存为草稿。'); return; }
    if (kind === 'schedule' && planStart && planEnd && planEnd < planStart) {
      setSaveError('结束时间不能早于开始时间。'); return;
    }
    const cleanFields = fields
      .map((field) => ({ ...field, name: field.name.trim(), value: field.value.trim() }))
      .filter((field) => field.name || field.value);
    const patch = {
      title: trimmed, typeId, workspaceId, status,
      starred: kind === 'direction' ? false : starred,
      content, fields: cleanFields, priority, dueDate: dueDate || null,
      planDate: kind === 'schedule' ? planDate || null : null,
      planStart: kind === 'schedule' ? planStart || null : null,
      planEnd: kind === 'schedule' ? planEnd || null : null,
      sub: kind === 'project' ? sub : null,
      recurrence: kind === 'todo' ? recurrence : null,
      projectId: kind !== 'project' ? projectId || null : null,
      literature: kind === 'literature' ? literature : null,
      attachments,
    };
    savingLock.current = true;
    setSaving(true);
    const operation = (async () => {
    try {
      if (committedId.current) await updateRecord(committedId.current, patch);
      else {
        const record = await addRecord({ id: sessionRecordId, ...patch });
        committedId.current = record.id;
      }
      const timestamp = Date.now();
      setSavedAt(timestamp);
      setSavedPayload(payload);
      try {
        await draft.markSaved();
      } catch (error) {
        setSaveError(`记录已保存，但草稿清理失败；重试不会重复创建记录。${String(error)}`);
        return;
      }
      window.dispatchEvent(new CustomEvent(RECORD_SAVED_EVENT, {
        detail: { recordId: committedId.current, title: trimmed, workspaceId, typeId, savedAt: timestamp },
      }));
      onClose();
    } catch (error) {
      setSaveError(`保存失败，内容仍保留在编辑器中。${error instanceof Error ? error.message : String(error)}`);
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
    })();
    pendingSave.current = operation;
    return operation;
  };
  useEffect(() => registerDraftHandler({
    flush: () => pendingSave.current,
    isPending: () => savingLock.current,
  }), []);
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (!event.isComposing && event.keyCode !== 229) void saveRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const choosePaths = async (pathKind: 'file' | 'directory') => {
    try {
      const paths = await desktopPlatform.chooseLocalPaths(pathKind);
      setAttachments((current) => {
        const unique = paths.filter((path) => !current.some((item) => item.path === path));
        return [...current, ...unique.map((path) => ({ id: uid(), name: path.split(/[\\/]/).filter(Boolean).at(-1) ?? path, path, kind: pathKind }))];
      });
    } catch (error) { setSaveError(`无法选择路径：${String(error)}`); }
  };
  const exportText = async () => {
    try {
      await desktopPlatform.saveTextFile({
        suggestedName: `${(title.trim() || '未命名笔记').replace(/[<>:"/\\|?*]/g, '_')}.md`,
        contents: `${title.trim() ? `# ${title.trim()}\n\n` : ''}${content}`,
        mimeType: 'text/markdown',
      });
    } catch (error) { setSaveError(`另存失败：${String(error)}`); }
  };

  const onDelete = async () => {
    if (!existing) return;
    const confirmed = await confirmDialog({
      message: `将「${existing.title}」移到回收站？30 天内可恢复。`,
      confirmLabel: '删除',
      danger: true,
    });
    if (confirmed) {
      try {
        await deleteRecord(existing.id);
        await draft.discard();
        onClose();
      } catch (error) { setSaveError(`删除失败：${String(error)}`); }
    }
  };

  return (
    <Modal
      title={existing ? '编辑记录' : '新建记录'}
      className={`record-editor ${expanded ? 'record-editor-expanded' : ''}`}
      onClose={onClose}
      onRequestClose={requestClose}
      footer={
        <>
          <span className="editor-save-status" role="status" aria-live="polite">
            {saving ? '正在保存…' : savedAt && payload === savedPayload ? `已保存 ${new Date(savedAt).toLocaleTimeString()}` : draft.loading ? '正在读取草稿…' : draft.status === 'saving' ? '正在保存草稿…' : draft.status === 'saved' && draft.savedAt ? `草稿已保存 ${new Date(draft.savedAt).toLocaleTimeString()}` : payload !== savedPayload ? '修改尚未保存' : 'Ctrl / ⌘ + S 保存'}
          </span>
          {existing && (
            <button
              className="btn btn-ghost btn-danger"
              style={{ marginRight: 'auto' }}
              disabled={saving}
              onClick={() => void onDelete()}
            >
              <Trash2 size={14} />
              删除
            </button>
          )}
          <button className="btn btn-ghost" onClick={cancel} disabled={saving}>
            关闭
          </button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={saving || draft.loading || draft.loadFailed || !!draft.recoveredPayload}>
            {saving ? '保存中…' : committedId.current ? '保存修改' : '创建记录'}
          </button>
        </>
      }
    >
      {(saveError || draft.error) && (
        <div className="draft-notice draft-notice-warning" role="alert">
          <span>{saveError ?? `草稿${draft.loadFailed ? '读取' : '保存'}失败：${draft.error}。原内容已保留，可重试或另存正文。`}</span>
          <div>
            {draft.error && <button className="btn btn-ghost btn-sm" onClick={() => void draft.retry().catch(() => undefined)}>重试草稿</button>}
            <button className="btn btn-ghost btn-sm" onClick={() => void exportText()}>另存正文</button>
          </div>
        </div>
      )}
      {draft.recoveredPayload && (
        <div className="draft-notice" role="status">
          <span>发现一份未保存的草稿，要恢复吗？</span>
          <div>
            <button className="btn btn-ghost btn-sm" onClick={() => void draft.discard().catch(() => undefined)}>
              忽略
            </button>
            <button className="btn btn-primary btn-sm" onClick={restoreDraft}>
              恢复草稿
            </button>
          </div>
        </div>
      )}
      {showDiscardPrompt && (
        <div className="draft-notice draft-notice-warning" role="alert">
          <span>当前修改尚未保存。可以保存草稿后关闭，或继续编辑。</span>
          <div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowDiscardPrompt(false)}>
              继续编辑
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => void keepDraftAndClose()}>保留草稿并关闭</button>
            <button className="btn btn-danger btn-sm" onClick={() => void discardAndClose()}>
              放弃修改
            </button>
          </div>
        </div>
      )}
      <fieldset className="editor-fields" disabled={saving || draft.loading || draft.loadFailed || !!draft.recoveredPayload}>
      <div>
        <label className="form-label">标题</label>
        <input
          className="form-input"
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="给这条记录起个名字"
        />
      </div>

      <div className="editor-writing-toolbar">
        <span>正文支持 Markdown</span>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => setExpanded((value) => !value)}>
          {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}{expanded ? '还原编辑区' : '展开编辑区'}
        </button>
      </div>
      <div>
        <label className="form-label">正文 / 心得笔记</label>
        <MarkdownEditor
          value={content}
          onChange={setContent}
          onOpenExternal={(url) => desktopPlatform.openExternal(url)}
        />
      </div>

      <details className="editor-properties" open={kind === 'schedule' || kind === 'todo'}>
        <summary>记录属性 · 分类、工作区与关联</summary>
      <div className="form-row">
        <div>
          <label className="form-label">内容类型</label>
          <select className="form-select" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">工作区</label>
          <select
            className="form-select"
            value={workspaceId}
            onChange={(e) => {
              const nextWorkspaceId = e.target.value;
              setWorkspaceId(nextWorkspaceId);
              if (projectId && !records.some((record) => record.id === projectId && record.workspaceId === nextWorkspaceId)) {
                setProjectId('');
              }
            }}
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row">
        {kind === 'todo' ? (
          <>
            <div>
              <label className="form-label">优先级</label>
              <select
                className="form-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">截止日期</label>
              <input
                className="form-input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </>
        ) : kind === 'schedule' ? (
          <>
            <div>
              <label className="form-label">计划日期</label>
              <input
                className="form-input"
                type="date"
                value={planDate}
                onChange={(e) => setPlanDate(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">开始（可选）</label>
              <input
                className="form-input"
                type="time"
                value={planStart}
                onChange={(e) => setPlanStart(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">结束（可选）</label>
              <input
                className="form-input"
                type="time"
                value={planEnd}
                onChange={(e) => setPlanEnd(e.target.value)}
              />
            </div>
          </>
        ) : (
          <div>
            <label className="form-label">状态</label>
            <select
              className="form-select"
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
            >
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        )}
        {kind === 'project' && (
          <div>
            <label className="form-label">项目类别</label>
            <select
              className="form-select"
              value={sub}
              onChange={(e) => setSub(e.target.value as 'vertical' | 'horizontal')}
            >
              <option value="vertical">纵向项目</option>
              <option value="horizontal">横向项目</option>
            </select>
          </div>
        )}
        {kind === 'direction' ? (
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 6 }}>
            <label className="checkline">
              <input
                type="checkbox"
                checked={priority === 'high'}
                onChange={(e) => setPriority(e.target.checked ? 'high' : 'none')}
              />
              <Star size={14} color="#d9a441" fill={priority === 'high' ? '#d9a441' : 'none'} />
              设为主要方向
            </label>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 6 }}>
            <label className="checkline">
              <input type="checkbox" checked={starred} onChange={(e) => setStarred(e.target.checked)} />
              <Star size={14} color="#d9a441" fill={starred ? '#d9a441' : 'none'} />
              设为今日重点
            </label>
          </div>
        )}
      </div>

      {kind === 'todo' && <RecurrenceFields value={recurrence} onChange={setRecurrence} />}
      {kind !== 'project' && (
        <div className="todo-relations">
          <div>
            <label className="form-label" htmlFor="record-project">关联项目</label>
            <select
              id="record-project"
              className="form-select"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="">不关联项目</option>
              {availableProjects.map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {kind === 'literature' && <LiteratureFields value={literature} onChange={setLiterature} />}


      <div>
        <label className="form-label">自定义字段（如：项目编号、经费、甲方、会议目标…）</label>
        {fields.map((f) => (
          <div className="field-row" key={f.id}>
            <input
              className="form-input name"
              value={f.name}
              onChange={(e) => setField(f.id, { name: e.target.value })}
              placeholder="字段名"
            />
            <input
              className="form-input"
              value={f.value}
              onChange={(e) => setField(f.id, { value: e.target.value })}
              placeholder="字段值"
            />
            <button
              className="icon-btn danger"
              onClick={() => setFields((fs) => fs.filter((x) => x.id !== f.id))}
              title="删除字段"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setFields((fs) => [...fs, { id: uid(), name: '', value: '' }])}
        >
          <Plus size={14} />
          添加字段
        </button>
      </div>
      </details>
      <section className="editor-attachments" aria-label="本地文件与文件夹">
        <div className="editor-writing-toolbar">
          <span>本地文件与文件夹 · 保存路径引用</span>
          <div>
            <button className="btn btn-ghost btn-sm" onClick={() => void choosePaths('file')} disabled={!desktopPlatform.isDesktop}><FilePlus2 size={14} /> 文件</button>
            <button className="btn btn-ghost btn-sm" onClick={() => void choosePaths('directory')} disabled={!desktopPlatform.isDesktop}><FolderPlus size={14} /> 文件夹</button>
          </div>
        </div>
        {attachments.map((attachment) => (
          <div className="editor-attachment" key={attachment.id}>
            <button className="btn btn-ghost" title={attachment.path} onClick={() => void desktopPlatform.openLocalPath(attachment.path).catch((error) => setSaveError(`无法打开路径：${String(error)}`))}>{attachment.name}</button>
            <span title={attachment.path}>{attachment.path}</span>
            <button className="icon-btn danger" aria-label={`移除引用 ${attachment.name}`} onClick={() => setAttachments((items) => items.filter((item) => item.id !== attachment.id))}><Trash2 size={14} /></button>
          </div>
        ))}
      </section>
      </fieldset>
    </Modal>
  );
}
