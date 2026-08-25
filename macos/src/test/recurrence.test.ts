import { describe, expect, it } from 'vitest';
import { nextDueDate } from '../features/todos/recurrence';

describe('nextDueDate', () => {
  it('advances daily and skips occurrences that are already due', () => {
    expect(nextDueDate('2026-08-17', { frequency: 'daily', interval: 2 }, '2026-08-17')).toBe('2026-08-19');
    expect(nextDueDate('2026-08-01', { frequency: 'daily', interval: 2 }, '2026-08-17')).toBe('2026-08-19');
  });

  it('advances weekly until strictly after today', () => {
    expect(nextDueDate('2026-08-01', { frequency: 'weekly', interval: 1 }, '2026-08-17')).toBe('2026-08-22');
  });

  it('clamps month-end dates while retaining the desired day', () => {
    expect(nextDueDate('2026-01-31', { frequency: 'monthly', interval: 1 }, '2026-01-31')).toBe('2026-02-28');
    expect(nextDueDate('2028-01-31', { frequency: 'monthly', interval: 1 }, '2028-01-31')).toBe('2028-02-29');
    expect(nextDueDate('2026-01-31', { frequency: 'monthly', interval: 1 }, '2026-02-28')).toBe('2026-03-31');
  });

  it('rejects malformed dates and intervals', () => {
    expect(() => nextDueDate('2026-02-30', { frequency: 'daily', interval: 1 }, '2026-08-17')).toThrow();
    expect(() => nextDueDate('2026-08-17', { frequency: 'daily', interval: 0 }, '2026-08-17')).toThrow();
  });
});
