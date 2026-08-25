import type { Priority, Status } from './domain/models';

export type {
  AppSettings,
  CustomField,
  Draft,
  ExportPayload,
  LiteratureDetails,
  MotionMode,
  Priority,
  ReadingStatus,
  RecordItem,
  RecurrenceFrequency,
  RecurrenceRule,
  Status,
  ThemeMode,
  TypeDef,
  TypeKind,
  WorkbenchSnapshot,
  Workspace,
} from './domain/models';

/** 可供分配的音符组合（保证各类型互不相同） */
export const NOTE_GLYPHS = [
  '♪',
  '♫',
  '♩',
  '♬',
  '𝄞',
  '𝄢',
  '𝅘𝅥',
  '𝅘𝅥𝅮',
  '𝅘𝅥𝅯',
  '𝅝',
  '𝅘𝅥',
  '𝅘𝅥𝅮',
  '♪♪',
  '♫♪',
  '♩♫',
  '♬♪',
  '♪♬',
  '♫♩',
  '𝄞♪',
  '𝅘𝅥♫',
  '♬♩',
  '𝅘𝅥𝅮♪',
];

export function pickNote(id: string, taken: string[]): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  for (let k = 0; k < NOTE_GLYPHS.length; k++) {
    const g = NOTE_GLYPHS[(h + k) % NOTE_GLYPHS.length];
    if (!taken.includes(g)) return g;
  }
  return NOTE_GLYPHS[h % NOTE_GLYPHS.length];
}

/** 科研项目的纵向 / 横向细分标签 */
export const SUB_LABEL: Record<string, string> = {
  vertical: '纵向',
  horizontal: '横向',
};

export const STATUS_LABEL: Record<Status, string> = {
  planned: '待开始',
  active: '进行中',
  paused: '已搁置',
  done: '已完成',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  none: '无',
  low: '低',
  medium: '中',
  high: '高',
};
