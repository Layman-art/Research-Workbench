import { describe, expect, it } from 'vitest';
import { overdueTodoCount, selectDueReminders } from '../features/notifications/reminders';
import { buildInitialSnapshot } from '../repositories';

describe('todo reminders', () => {
  it('selects only due and overdue incomplete, non-archived todos', () => {
    const base = buildInitialSnapshot().records.find((record) => record.typeId === 'todo')!;
    const records = [
      { ...base, id: 'future', dueDate: '2026-08-18', done: false, archived: false },
      { ...base, id: 'today', dueDate: '2026-08-17', done: false, archived: false },
      { ...base, id: 'overdue', dueDate: '2026-08-16', done: false, archived: false },
      { ...base, id: 'done', dueDate: '2026-08-16', done: true, archived: false },
      { ...base, id: 'archived', dueDate: '2026-08-16', done: false, archived: true },
    ];
    expect(selectDueReminders(records, 'todo', '2026-08-17').map((record) => record.id)).toEqual(['overdue', 'today']);
  });

  it('counts overdue todos only and excludes due-today', () => {
    const base = buildInitialSnapshot().records.find((record) => record.typeId === 'todo')!;
    expect(overdueTodoCount([
      { ...base, dueDate: '2026-08-16', done: false, archived: false },
      { ...base, id: 'today', dueDate: '2026-08-17', done: false, archived: false },
      { ...base, id: 'done', dueDate: '2026-08-15', done: true, archived: false },
    ], 'todo', '2026-08-17')).toBe(1);
  });
});
