import type { ReadingStatus } from '../../domain/models';

export const READING_STATUS_LABEL: Record<ReadingStatus, string> = {
  unread: '待读',
  reading: '在读',
  read: '已读',
};
