import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { desktopPlatform } from '../../platform';
import { backupService } from '../backups/backupService';
import { flushPendingDrafts } from '../drafts/draftLifecycle';
import { useToday } from '../../hooks/useToday';
import { useStore } from '../../stores';

export function useDesktopLifecycle() {
  const today = useToday();
  const phase = useStore((state) => state.phase);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!desktopPlatform.isDesktop || phase !== 'ready') return;
    let disposed = false;
    void useStore.getState().whenIdle().then(() => backupService.create(`daily-${today}`)).catch((reason: unknown) => {
      if (!disposed) setError(`自动备份失败：${String(reason)}。请到设置检查备份。`);
    });
    return () => { disposed = true; };
  }, [today, phase]);
  useEffect(() => {
    if (!desktopPlatform.isDesktop) return;
    let stopped = false;
    let busy = false;
    let dispose: (() => void) | undefined;
    void listen('workbench:exit-requested', async () => {
      if (busy) return;
      busy = true;
      try {
        await flushPendingDrafts();
        await useStore.getState().whenIdle();
        await backupService.finishExit();
      } catch (reason) {
        setError(`退出前保存失败，已保留窗口：${String(reason)}`);
        busy = false;
      }
    }).then((unlisten) => { if (stopped) unlisten(); else dispose = unlisten; })
      .catch((reason: unknown) => { if (!stopped) setError(`无法注册退出保存：${String(reason)}`); });
    return () => { stopped = true; dispose?.(); };
  }, []);
  return { error, clearError: () => setError(null) };
}
