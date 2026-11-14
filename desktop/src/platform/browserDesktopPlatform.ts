import { assertHttpsUrl, type DesktopPlatform } from './DesktopPlatform';

type Opener = (url: string) => void;

const defaultOpener: Opener = (url) => {
  window.open(url, '_blank', 'noopener,noreferrer');
};

export function createBrowserDesktopPlatform(opener: Opener = defaultOpener): DesktopPlatform {
  return {
    isDesktop: false,
    minimize: async () => undefined,
    toggleMaximize: async () => undefined,
    close: async () => undefined,
    openExternal: async (url) => opener(assertHttpsUrl(url)),
    openDataDirectory: async () => undefined,
    chooseLocalPaths: async () => [],
    openLocalPath: async () => { throw new Error('请在桌面安装版中打开本地文件'); },
    getAutoLaunch: async () => false,
    setAutoLaunch: async () => false,
    getCloseToTray: async () => false,
    setCloseToTray: async () => false,
    saveTextFile: async ({ suggestedName, contents, mimeType }) => {
      const url = URL.createObjectURL(new Blob([contents], { type: `${mimeType};charset=utf-8` }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = suggestedName;
      anchor.click();
      URL.revokeObjectURL(url);
      return suggestedName;
    },
    getNotificationPermission: async () => 'prompt',
    requestNotificationPermission: async () => 'denied',
    sendTodoNotification: async () => undefined,
    onNotificationAction: async () => () => undefined,
    setBadgeCount: async () => undefined,
  };
}

export const browserDesktopPlatform = createBrowserDesktopPlatform();
