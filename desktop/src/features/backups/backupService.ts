import { invoke } from '@tauri-apps/api/core';
import { desktopPlatform } from '../../platform';

export interface BackupInfo { name: string; bytes: number; createdAt: number }
export interface StorageInfo { directory: string; databaseBytes: number; backupBytes: number; backups: BackupInfo[] }

export const backupService = {
  create: (reason: string) => desktopPlatform.isDesktop
    ? invoke<BackupInfo>('create_backup', { reason }) : Promise.resolve(null),
  info: () => desktopPlatform.isDesktop
    ? invoke<StorageInfo>('storage_info') : Promise.resolve(null),
  restore: (name: string) => invoke<void>('restore_backup', { name }),
  finishExit: (restart = false) => invoke<void>('finish_exit', { restart }),
};
