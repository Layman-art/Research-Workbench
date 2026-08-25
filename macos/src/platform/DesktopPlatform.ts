export type NotificationPermissionState = 'prompt' | 'granted' | 'denied';

export interface DesktopPlatform {
  readonly isDesktop: boolean;
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
  openExternal(url: string): Promise<void>;
  openDataDirectory(): Promise<void>;
  getAutoLaunch(): Promise<boolean>;
  setAutoLaunch(enabled: boolean): Promise<boolean>;
  getCloseToTray(): Promise<boolean>;
  setCloseToTray(enabled: boolean): Promise<boolean>;
  saveTextFile(options: {
    suggestedName: string;
    contents: string;
    mimeType: string;
  }): Promise<string | null>;
  getNotificationPermission(): Promise<NotificationPermissionState>;
  requestNotificationPermission(): Promise<NotificationPermissionState>;
  sendTodoNotification(recordId: string, title: string, body: string): Promise<void>;
  onNotificationAction(callback: (recordId: string) => void): Promise<() => void>;
  setBadgeCount(count: number): Promise<void>;
}

export function assertHttpsUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('链接格式无效');
  }
  if (url.protocol !== 'https:') throw new Error('只允许打开 HTTPS 链接');
  return url.toString();
}

export function assertBadgeCount(count: number): number {
  if (!Number.isInteger(count) || count < 0) throw new Error('角标数量必须是非负整数');
  return count;
}
