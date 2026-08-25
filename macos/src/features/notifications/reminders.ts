import type { RecordItem } from '../../domain/models';

export function selectDueReminders(
  records: RecordItem[],
  todoTypeId: string,
  today: string,
): RecordItem[] {
  return records
    .filter((record) =>
      record.typeId === todoTypeId &&
      !record.done &&
      !record.archived &&
      !!record.dueDate &&
      record.dueDate <= today,
    )
    .sort((left, right) => left.dueDate!.localeCompare(right.dueDate!));
}

export function overdueTodoCount(
  records: RecordItem[],
  todoTypeId: string,
  today: string,
): number {
  return records.filter((record) =>
    record.typeId === todoTypeId &&
    !record.done &&
    !record.archived &&
    !!record.dueDate &&
    record.dueDate < today,
  ).length;
}
