import type { RecordItem, Status } from '../../domain/models';

export async function moveProjectToStatus(
  updateRecord: (id: string, patch: Partial<RecordItem>) => Promise<void>,
  projectId: string,
  status: Status,
) {
  await updateRecord(projectId, { status });
}
