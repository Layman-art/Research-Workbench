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

function WorkbenchApp() {
  const { view, types, settings, search } = useStore(
    useShallow((state) => ({ view: state.view, types: state.types, settings: state.settings, search: state.search })),
  );
  const [editor, setEditor] = useState<EditorRequest | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  useAppearance(settings?.theme ?? 'system', settings?.motion ?? 'system');
  useNativeReminders();

  useEffect(() => {
    const handler = (e: Event) => setEditor((e as CustomEvent<EditorRequest>).detail ?? {});
    window.addEventListener(EDITOR_EVENT, handler);
    return () => window.removeEventListener(EDITOR_EVENT, handler);
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
      {editor && <EditorModal request={editor} onClose={() => setEditor(null)} />}
      {confirm && <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

export default function App() {
  return (
    <AppStartup>
      <WorkbenchApp />
    </AppStartup>
  );
}
