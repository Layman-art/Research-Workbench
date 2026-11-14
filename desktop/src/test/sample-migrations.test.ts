import { describe, expect, it } from 'vitest';
import { ensureScheduleType, mergeProjectTypes } from '../sample';
import { buildInitialSnapshot } from '../repositories';
import type { TypeDef } from '../types';

describe('sample migrations', () => {
  it('adds the schedule type idempotently', () => {
    const types = buildInitialSnapshot().types.filter((type) => type.id !== 'schedule');
    const once = ensureScheduleType(types);
    expect(once.some((type) => type.id === 'schedule')).toBe(true);
    expect(ensureScheduleType(once)).toBe(once);
  });

  it('merges legacy vertical and horizontal project types idempotently', () => {
    const snapshot = buildInitialSnapshot();
    const oldTypes: TypeDef[] = [
      { id: 'horizontal', name: '横向项目', kind: 'generic', icon: 'building', note: '♪', builtin: true },
      { id: 'vertical', name: '纵向项目', kind: 'generic', icon: 'landmark', note: '♫', builtin: true },
      ...snapshot.types.filter((type) => type.id !== 'project'),
    ];
    const oldRecords = snapshot.records.map((record) =>
      record.typeId === 'project'
        ? {
            ...record,
            typeId: record.sub === 'horizontal' ? 'horizontal' : 'vertical',
            sub: undefined,
          }
        : record,
    );

    const merged = mergeProjectTypes(oldTypes, oldRecords);
    expect(merged.types.filter((type) => type.id === 'project')).toHaveLength(1);
    expect(
      merged.records
        .filter((record) => record.typeId === 'project')
        .every((record) => record.sub === 'vertical' || record.sub === 'horizontal'),
    ).toBe(true);
    expect(mergeProjectTypes(merged.types, merged.records)).toEqual(merged);
  });
});
