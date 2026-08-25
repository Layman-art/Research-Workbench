import type { RecurrenceRule } from '../../domain/models';

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

function parseDate(value: string): CalendarDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`无效日期：${value}`);
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const verified = new Date(Date.UTC(date.year, date.month - 1, date.day));
  if (
    verified.getUTCFullYear() !== date.year ||
    verified.getUTCMonth() + 1 !== date.month ||
    verified.getUTCDate() !== date.day
  ) throw new Error(`无效日期：${value}`);
  return date;
}

function formatDate(date: CalendarDate): string {
  return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

function addDays(date: CalendarDate, amount: number): CalendarDate {
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day));
  value.setUTCDate(value.getUTCDate() + amount);
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
}

function addMonths(date: CalendarDate, amount: number, desiredDay: number): CalendarDate {
  const absoluteMonth = date.year * 12 + date.month - 1 + amount;
  const year = Math.floor(absoluteMonth / 12);
  const month = (absoluteMonth % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { year, month, day: Math.min(desiredDay, lastDay) };
}

export function nextDueDate(
  currentDueDate: string,
  rule: RecurrenceRule,
  today: string,
): string {
  const current = parseDate(currentDueDate);
  parseDate(today);
  if (!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 99) {
    throw new Error('重复间隔必须是 1–99 的整数');
  }

  let step = 1;
  while (step < 100_000) {
    const candidate =
      rule.frequency === 'monthly'
        ? addMonths(current, rule.interval * step, current.day)
        : addDays(current, rule.interval * step * (rule.frequency === 'weekly' ? 7 : 1));
    const result = formatDate(candidate);
    if (result > today) return result;
    step += 1;
  }
  throw new Error('无法计算下一次重复日期');
}
