import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from './stores';
import { Sidebar } from './components/Sidebar';
import { TitleBar } from './components/TitleBar';
import { TopBar } from './components/TopBar';
import { Dashboard } from './components/Dashboard';
import { RecordsView } from './components/RecordsView';
import { TodoView } from './components/TodoView';
import { ScheduleView } from './components/ScheduleView';
import { SettingsView } from './components/SettingsView';
import { GlobalSearchResults } from './components/GlobalSearchResults';
import { EditorModal } from './components/EditorModal';
import { ConfirmDialog, type ConfirmState } from './components/ConfirmDialog';
import { EDITOR_EVENT, type EditorRequest } from './editorBus';
import { CONFIRM_EVENT, type ConfirmRequest } from './confirmBus';
import { AppStartup } from './components/AppStartup';
import { useAppearance } from './features/theme/useAppearance';
import { useNativeReminders } from './features/notifications/useNativeReminders';
import { TrashView } from './components/TrashView';
import { ReportsView } from './components/ReportsView';
import { flushPendingDrafts } from './features/drafts/draftLifecycle';
import { useDesktopLifecycle } from './features/lifecycle/useDesktopLifecycle';
import './features/lifecycle/feedback.css';

interface Feedback { text: string; recordId?: string; deletedIds?: string[] }

function WorkbenchApp() {
  const { view, types, settings, search } = useStore(
    useShallow((state) => ({ view: state.view, types: state.types, settings: state.settings, search: state.search })),
  );
  const [editor, setEditor] = useState<(EditorRequest & { session: number }) | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  useAppearance(settings?.theme ?? 'system', settings?.motion ?? 'system');
  useNativeReminders();

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 12_000);
    return () => clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    let session = 0;
    const handler = (e: Event) => {
      const request = (e as CustomEvent<EditorRequest>).detail ?? {};
      const next = ++session;
      void flushPendingDrafts().then(() => {
        if (next === session) setEditor({ ...request, session: next });
      }).catch((error: unknown) => useStore.setState({ error: `草稿尚未保存，已保留当前编辑内容：${String(error)}` }));
    };
    window.addEventListener(EDITOR_EVENT, handler);
    return () => window.removeEventListener(EDITOR_EVENT, handler);
  }, []);

  useEffect(() => {
    const saved = (event: Event) => {
      const detail = (event as CustomEvent<{ recordId: string; title: string }>).detail;
      setFeedback({ text: `已保存「${detail.title}」`, recordId: detail.recordId });
    };
    window.addEventListener('workbench:record-saved', saved);
    const unsubscribe = useStore.subscribe((state, previous) => {
      if (state.records === previous.records) return;
      const previousActive = new Set(previous.records.filter((record) => !record.deletedAt).map((record) => record.id));
      const deletedIds = state.records.filter((record) => record.deletedAt && previousActive.has(record.id)).map((record) => record.id);
      if (deletedIds.length) setFeedback({ text: `已移入回收站（${deletedIds.length} 条），保留 30 天`, deletedIds });
    });
    return () => { window.removeEventListener('workbench:record-saved', saved); unsubscribe(); };
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ConfirmRequest>).detail;
      setConfirm(detail as ConfirmState);
    };
    window.addEventListener(CONFIRM_EVENT, handler);
    return () => window.removeEventListener(CONFIRM_EVENT, handler);
  }, []);

  const type = types.find((t) => t.id === view);

  return (
    <div className="app">
      <TitleBar />
      <div className="app-body">
        <Sidebar />
        <div className="main">
          <TopBar />
          <main className="content">
            {search.trim() ? (
              <GlobalSearchResults />
            ) : view === 'settings' ? (
              <SettingsView />
            ) : view === 'trash' ? (
              <TrashView />
            ) : view === 'reports' ? (
              <ReportsView />
            ) : view === 'dashboard' || !type ? (
              <Dashboard />
            ) : type.kind === 'todo' ? (
              <TodoView typeId={type.id} />
            ) : type.kind === 'schedule' ? (
              <ScheduleView typeId={type.id} />
            ) : (
              <RecordsView typeId={type.id} />
            )}
          </main>
        </div>
      </div>
      {feedback && <div className="feedback-toast" role="status">
        <span>{feedback.text}</span>
        {feedback.recordId && <button className="btn btn-ghost btn-sm" onClick={() => {
          const record = useStore.getState().records.find((item) => item.id === feedback.recordId);
          if (!record) return;
          useStore.setState({ search: '', statusFilter: 'all', workspaceFilter: record.workspaceId, view: record.typeId });
          window.dispatchEvent(new CustomEvent(EDITOR_EVENT, { detail: { recordId: record.id } }));
          setFeedback(null);
        }}>查看</button>}
        {feedback.deletedIds && <button className="btn btn-ghost btn-sm" onClick={() => {
          void useStore.getState().restoreRecords(feedback.deletedIds!).then(() => setFeedback({ text: '已撤销删除' })).catch(() => undefined);
        }}>撤销</button>}
        <button className="icon-btn" aria-label="关闭提示" onClick={() => setFeedback(null)}>×</button>
      </div>}
      {editor && <EditorModal key={editor.session} request={editor} onClose={() => setEditor(null)} />}
      {confirm && <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

export default function App() {
  const { error: lifecycleError, clearError } = useDesktopLifecycle();
  const error = useStore((state) => state.error);
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      useStore.setState({ error: `操作未完成：${event.reason instanceof Error ? event.reason.message : String(event.reason)}` });
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);
  return (
    <>
      {(error || lifecycleError) && <div className="error-banner" role="alert">
        <span>{error || lifecycleError}</span>
        <button className="btn btn-ghost btn-sm" onClick={() => { clearError(); useStore.setState({ error: null }); }}>关闭提示</button>
      </div>}
    <AppStartup>
      <WorkbenchApp />
    </AppStartup>
    </>
  );
}
