import type { RecordItem } from '../../domain/models';
import { nextDueDate } from './recurrence';

function localDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function completeTodoRecords(
  record: RecordItem,
  completedAt: number,
  nextId: string,
): { completed: RecordItem; next: RecordItem | null } {
  if (record.done) return { completed: record, next: null };
  const completed = { ...record, done: true, updatedAt: completedAt };
  if (!record.recurrence || !record.dueDate) return { completed, next: null };
  const next: RecordItem = {
    ...record,
    id: nextId,
    dueDate: nextDueDate(record.dueDate, record.recurrence, localDate(completedAt)),
    done: false,
    starred: false,
    createdAt: completedAt,
    updatedAt: completedAt,
  };
  return { completed, next };
}
