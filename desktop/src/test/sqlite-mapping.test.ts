import { describe, expect, it } from 'vitest';
import { buildSampleRecords } from '../sample';
import { recordToRow, rowToRecord } from '../repositories/SqliteWorkbenchRepository';

describe('SQLite record mapping', () => {
  it('round-trips Markdown, project link, recurrence, fields, and literature metadata', () => {
    const record = {
      ...buildSampleRecords()[0],
      id: 'mapping-record',
      title: '论文阅读',
      content: '# 实验\n\n```bash\npnpm test\n```',
      projectId: 'sample-1',
      recurrence: { frequency: 'weekly' as const, interval: 2 },
      literature: {
        authors: 'Ada Lovelace; Alan Turing',
        year: 2026,
        doi: '10.1000/example',
        url: 'https://doi.org/10.1000/example',
        readingStatus: 'reading' as const,
      },
      fields: [{ id: 'field-1', name: '命令', value: 'pnpm test' }],
    };

    expect(rowToRecord(recordToRow(record))).toEqual(record);
  });

  it('rejects a non-positive recurrence interval before persistence', () => {
    const record = {
      ...buildSampleRecords()[0],
      recurrence: { frequency: 'daily' as const, interval: 0 },
    };

    expect(() => recordToRow(record)).toThrow('重复间隔必须大于 0');
  });
});
