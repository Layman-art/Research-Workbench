import { buildSampleRecords } from '../sample';
import type { RecordItem } from '../types';

export function buildRecordFixture(count = 50): RecordItem[] {
  const samples = buildSampleRecords();
  return Array.from({ length: count }, (_, index) => {
    const source = samples[index % samples.length];
    return {
      ...source,
      id: `fixture-${index + 1}`,
      title: `${source.title} ${index + 1}`,
      fields: source.fields.map((field) => ({
        ...field,
        id: `${field.id}-${index + 1}`,
      })),
      createdAt: source.createdAt + index,
      updatedAt: source.updatedAt + index,
    };
  });
}
