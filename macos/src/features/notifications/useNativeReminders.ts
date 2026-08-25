import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../../stores';
import { desktopPlatform } from '../../platform';
import { workbenchRepository } from '../../repositories';
import { requestEditor } from '../../editorBus';
import { overdueTodoCount, selectDueReminders } from './reminders';

function localToday(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function useNativeReminders() {
  const { records, types, settings, setView, setStatusFilter } = useStore(
    useShallow((state) => ({
      records: state.records,
      types: state.types,
      settings: state.settings,
      setView: state.setView,
      setStatusFilter: state.setStatusFilter,
    })),
  );
  const [today, setToday] = useState(localToday);
  const todoTypeId = useMemo(() => types.find((type) => type.kind === 'todo')?.id, [types]);

  useEffect(() => {
    const timer = window.setInterval(() => setToday(localToday()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!desktopPlatform.isDesktop || !todoTypeId) return;
    void desktopPlatform.setBadgeCount(overdueTodoCount(records, todoTypeId, today));
  }, [records, todoTypeId, today]);

  useEffect(() => {
    if (!desktopPlatform.isDesktop || !todoTypeId || !settings?.notificationsEnabled) return;
    const poll = async () => {
      if (await desktopPlatform.getNotificationPermission() !== 'granted') return;
      for (const record of selectDueReminders(records, todoTypeId, localToday())) {
        const occurrenceKey = `${record.dueDate}:due`;
        if (await workbenchRepository.reserveReminder(record.id, occurrenceKey, Date.now())) {
          const dueLabel = record.dueDate! < localToday() ? `已于 ${record.dueDate} 到期` : '今天到期';
          await desktopPlatform.sendTodoNotification(record.id, record.title, dueLabel);
        }
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 15 * 60_000);
    return () => window.clearInterval(timer);
  }, [records, settings?.notificationsEnabled, todoTypeId]);

  useEffect(() => {
    if (!desktopPlatform.isDesktop || !todoTypeId) return;
    let dispose: (() => void) | undefined;
    void desktopPlatform.onNotificationAction((recordId) => {
      setStatusFilter('all');
      setView(todoTypeId);
      requestEditor({ recordId });
    }).then((unlisten) => { dispose = unlisten; });
    return () => dispose?.();
  }, [setStatusFilter, setView, todoTypeId]);
}
