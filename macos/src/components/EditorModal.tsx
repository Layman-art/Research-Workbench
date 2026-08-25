import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Plus, Star, Trash2 } from 'lucide-react';
import { useStore, uid } from '../stores';
import { Modal } from './Modal';
import type { CustomField, LiteratureDetails, Priority, RecurrenceRule, Status } from '../types';
import { PRIORITY_LABEL, STATUS_LABEL } from '../types';
import type { EditorRequest } from '../editorBus';
import { confirmDialog } from '../confirmBus';
import { todayStr } from '../utils';
import { MarkdownEditor } from '../features/markdown/MarkdownEditor';
import { desktopPlatform } from '../platform';
import { useRecordDraft } from '../features/drafts/useRecordDraft';
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
}

export function EditorModal({ request, onClose }: { request: EditorRequest; onClose: () => void }) {
  const { records, types, workspaces, addRecord, updateRecord, deleteRecord } = useStore(
    useShallow((state) => ({
      records: state.records,
      types: state.types,
      workspaces: state.workspaces,
      addRecord: state.addRecord,
      updateRecord: state.updateRecord,
      deleteRecord: state.deleteRecord,
    })),
  );
  const existing = request.recordId ? records.find((r) => r.id === request.recordId) : undefined;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [typeId, setTypeId] = useState(existing?.typeId ?? request.typeId ?? types[0]?.id ?? '');
  const [workspaceId, setWorkspaceId] = useState(existing?.workspaceId ?? workspaces[0]?.id ?? '');
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
      workspaceId: existing?.workspaceId ?? workspaces[0]?.id ?? '',
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
    } satisfies EditorDraftData),
  ).current;
  const draftId = useRef(existing ? `record:${existing.id}` : `new:${uid()}`).current;
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
      } satisfies EditorDraftData),
    [content, dueDate, fields, literature, planDate, planEnd, planStart, priority, projectId, recurrence, starred, status, sub, title, typeId, workspaceId],
  );
  const draft = useRecordDraft({
    draftId,
    recordId: existing?.id ?? null,
    initialPayload,
    payload,
    repository: workbenchRepository,
  });

  const selectedType = types.find((type) => type.id === typeId);
  const kind = selectedType?.id === 'literature' ? 'literature' : (selectedType?.kind ?? 'generic');
  const projectTypeIds = new Set(types.filter((type) => type.kind === 'project').map((type) => type.id));
  const availableProjects = records.filter(
    (record) => projectTypeIds.has(record.typeId) && !record.archived && record.workspaceId === workspaceId,
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
      draft.clearRecovered();
    } catch {
      void draft.discard();
    }
  };

  const requestClose = () => {
    if (payload === initialPayload) return true;
    setShowDiscardPrompt(true);
    return false;
  };

  const cancel = () => {
    if (requestClose()) onClose();
  };

  const discardAndClose = async () => {
    await draft.discard();
    onClose();
  };

  const save = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const cleanFields = fields
      .map((f) => ({ ...f, name: f.name.trim(), value: f.value.trim() }))
      .filter((f) => f.name || f.value);
    const patch = {
      title: trimmed,
      typeId,
      workspaceId,
      status,
      starred: kind === 'direction' ? false : starred,
      content,
      fields: cleanFields,
      priority,
      dueDate: dueDate || null,
      planDate: kind === 'schedule' ? planDate || null : null,
      planStart: kind === 'schedule' ? planStart || null : null,
      planEnd: kind === 'schedule' ? planEnd || null : null,
      sub: kind === 'project' ? sub : null,
      recurrence: kind === 'todo' ? recurrence : null,
      projectId: kind === 'todo' ? projectId || null : null,
      literature: kind === 'literature' ? literature : null,
    };
    if (existing) {
      await updateRecord(existing.id, patch);
    } else {
      await addRecord(patch);
    }
    await draft.discard();
    onClose();
  };

  const onDelete = async () => {
    if (!existing) return;
    const confirmed = await confirmDialog({
      message: `确定删除「${existing.title}」吗？此操作不可恢复。`,
      confirmLabel: '删除',
      danger: true,
    });
    if (confirmed) {
      await deleteRecord(existing.id);
      await draft.discard();
      onClose();
    }
  };

  return (
    <Modal
      title={existing ? '编辑记录' : '新建记录'}
      onClose={onClose}
      onRequestClose={requestClose}
      footer={
        <>
          {existing && (
            <button
              className="btn btn-ghost btn-danger"
              style={{ marginRight: 'auto' }}
              onClick={() => void onDelete()}
            >
              <Trash2 size={14} />
              删除
            </button>
          )}
          <button className="btn btn-ghost" onClick={cancel}>
            取消
          </button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={!title.trim()}>
            {existing ? '保存修改' : '创建记录'}
          </button>
        </>
      }
    >
      {draft.recoveredPayload && (
        <div className="draft-notice" role="status">
          <span>发现一份未保存的草稿，要恢复吗？</span>
          <div>
            <button className="btn btn-ghost btn-sm" onClick={() => void draft.discard()}>
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
          <span>当前修改尚未保存，确定放弃吗？</span>
          <div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowDiscardPrompt(false)}>
              继续编辑
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => void discardAndClose()}>
              放弃修改
            </button>
          </div>
        </div>
      )}
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

      {kind === 'todo' && (
        <div className="todo-relations">
          <RecurrenceFields value={recurrence} onChange={setRecurrence} />
          <div>
            <label className="form-label" htmlFor="todo-project">关联项目</label>
            <select
              id="todo-project"
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
        <label className="form-label">正文 / 心得笔记</label>
        <MarkdownEditor
          value={content}
          onChange={setContent}
          onOpenExternal={(url) => desktopPlatform.openExternal(url)}
        />
      </div>

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
    </Modal>
  );
}
