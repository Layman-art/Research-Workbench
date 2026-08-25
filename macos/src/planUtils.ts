import type { RecordItem } from './types';

/** 与月相图同系的柔和色板，按记录 id 稳定取色 */
const PALETTE = [
  '#d9a441',
  '#c96442',
  '#7c9a6d',
  '#8fa3bf',
  '#e6a15c',
  '#a9512f',
  '#6d8a7c',
  '#b0879f',
];

export function planColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** 时间范围文本：「14:00 – 15:30」/「20:00」/「全天」 */
export function planTimeText(r: RecordItem): string {
  if (r.planStart && r.planEnd) return `${r.planStart} – ${r.planEnd}`;
  if (r.planStart) return r.planStart;
  return '全天';
}

export function sortPlans(list: RecordItem[]): RecordItem[] {
  return [...list].sort(
    (a, b) =>
      (a.planStart ?? '').localeCompare(b.planStart ?? '') || a.createdAt - b.createdAt,
  );
}

/** 手动排序键：有 order 用 order，否则按更新时间倒序兜底（与旧行为一致） */
export function orderKey(r: RecordItem): number {
  return r.order ?? -r.updatedAt;
}
