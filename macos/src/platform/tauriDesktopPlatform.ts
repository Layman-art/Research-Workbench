import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';
import { open } from '@tauri-apps/plugin-shell';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { assertBadgeCount, assertHttpsUrl, type DesktopPlatform } from './DesktopPlatform';

export const tauriDesktopPlatform: DesktopPlatform = {
  isDesktop: true,
  minimize: () => getCurrentWindow().minimize(),
  toggleMaximize: () => getCurrentWindow().toggleMaximize(),
  close: () => getCurrentWindow().close(),
  openExternal: async (url) => open(assertHttpsUrl(url)),
  openDataDirectory: async () => invoke('open_data_directory'),
  getAutoLaunch: () => isEnabled(),
  setAutoLaunch: async (enabled) => {
    if (enabled) await enable();
    else await disable();
    return isEnabled();
  },
  getCloseToTray: () => invoke<boolean>('get_close_to_tray'),
  setCloseToTray: (enabled) => invoke<boolean>('set_close_to_tray', { enabled }),
  saveTextFile: async ({ suggestedName, contents }) => {
    const path = await save({ defaultPath: suggestedName });
    if (!path) return null;
    await writeTextFile(path, contents);
    return path.split(/[\\/]/).pop() ?? suggestedName;
  },
  getNotificationPermission: async () => {
    const { isPermissionGranted } = await import('@tauri-apps/plugin-notification');
    return (await isPermissionGranted()) ? 'granted' : 'prompt';
  },
  requestNotificationPermission: async () => {
    const { requestPermission } = await import('@tauri-apps/plugin-notification');
    const permission = await requestPermission();
    return permission === 'granted' ? 'granted' : permission === 'denied' ? 'denied' : 'prompt';
  },
  sendTodoNotification: async (recordId, title, body) => {
    const { sendNotification } = await import('@tauri-apps/plugin-notification');
    sendNotification({ title, body, extra: { recordId }, autoCancel: true });
  },
  onNotificationAction: async (callback) => {
    const { onAction } = await import('@tauri-apps/plugin-notification');
    const listener = await onAction((notification) => {
      const recordId = notification.extra?.recordId;
      if (typeof recordId !== 'string') return;
      const window = getCurrentWindow();
      void window.show().then(() => window.setFocus());
      callback(recordId);
    });
    return () => void listener.unregister();
  },
  setBadgeCount: (count) => getCurrentWindow().setBadgeCount(assertBadgeCount(count) || undefined),
};
