import { isTauri } from '@tauri-apps/api/core';
import { browserDesktopPlatform } from './platform/browserDesktopPlatform';
import { tauriDesktopPlatform } from './platform/tauriDesktopPlatform';

export const desktopPlatform = isTauri() ? tauriDesktopPlatform : browserDesktopPlatform;
export type { DesktopPlatform } from './platform/DesktopPlatform';
