import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../../stores';
import { desktopPlatform } from '../../platform';
import { workbenchRepository } from '../../repositories';
import { requestEditor } from '../../editorBus';
import { overdueTodoCount, selectDueReminders } from './reminders';
import { useToday } from '../../hooks/useToday';

export function useNativeReminders() {
  const { records, types, settings, setView, setStatusFilter } = useStore(useShallow((state) => ({ records: state.records, types: state.types, settings: state.settings, setView: state.setView, setStatusFilter: state.setStatusFilter })));
  const today = useToday();
  const todoTypeIds = useMemo(() => types.filter((type) => type.kind === 'todo').map((type) => type.id), [types]);
  useEffect(() => {
    if (!desktopPlatform.isDesktop) return;
    void desktopPlatform.setBadgeCount(todoTypeIds.reduce((total, id) => total + overdueTodoCount(records, id, today), 0)).catch(() => undefined);
  }, [records, todoTypeIds, today]);

  useEffect(() => {
    if (!desktopPlatform.isDesktop || !settings?.notificationsEnabled) return;
    let inFlight = false;
    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        if (await desktopPlatform.getNotificationPermission() !== 'granted') return;
        for (const typeId of todoTypeIds) {
          for (const record of selectDueReminders(records, typeId, today)) {
            const occurrenceKey = `${record.dueDate}:due`;
            if (await workbenchRepository.reserveReminder(record.id, occurrenceKey, Date.now())) {
              await desktopPlatform.sendTodoNotification(record.id, record.title, record.dueDate! < today ? `已于 ${record.dueDate} 到期` : '今天到期');
            }
          }
        }
      } catch (error) {
        useStore.setState({ error: `提醒发送失败：${error instanceof Error ? error.message : String(error)}` });
      } finally { inFlight = false; }
    };
    const refresh = () => { void poll(); };
    refresh();
    const timer = window.setInterval(refresh, 15 * 60_000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [records, settings?.notificationsEnabled, todoTypeIds, today]);

  useEffect(() => {
    if (!desktopPlatform.isDesktop) return;
    let active = true;
    let dispose: (() => void) | undefined;
    void desktopPlatform.onNotificationAction((recordId) => {
      const record = useStore.getState().records.find((item) => item.id === recordId && !item.deletedAt);
      if (!record) return;
      setView(record.typeId);
      setStatusFilter('all');
      requestEditor({ recordId });
    }).then((unlisten) => { if (active) dispose = unlisten; else unlisten(); }).catch(() => undefined);
    return () => { active = false; dispose?.(); };
  }, [setStatusFilter, setView]);
}
