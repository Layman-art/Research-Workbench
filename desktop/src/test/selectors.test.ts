import { describe, expect, it } from 'vitest';
import { BUILTIN_TYPES, buildSampleRecords } from '../sample';
import { countRecordsByType, filterRecords } from '../store/selectors';
import { buildRecordFixture } from './fixtures';

describe('record selectors', () => {
  it('filters the 50-record fixture without mutating its input', () => {
    const records = buildRecordFixture();
    const before = records.map((record) => record.id);
    const result = filterRecords({
      records,
      typeId: 'note',
      workspaceId: 'all',
      status: 'all',
      query: '实验',
    });

    expect(records).toHaveLength(50);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((record) => record.typeId === 'note')).toBe(true);
    expect(records.map((record) => record.id)).toEqual(before);
  });

  it('counts every type in one pass with existing display semantics', () => {
    const counts = countRecordsByType(buildSampleRecords(), BUILTIN_TYPES);

    expect(counts.project).toBe(3);
    expect(counts.todo).toBe(4);
  });
});
