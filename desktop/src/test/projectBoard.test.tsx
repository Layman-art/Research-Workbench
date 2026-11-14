import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectBoard } from '../features/projects/ProjectBoard';
import { moveProjectToStatus } from '../features/projects/projectStatus';
import { buildInitialSnapshot } from '../repositories';

describe('ProjectBoard', () => {
  it('moves a project through the domain handler once', async () => {
    const updateRecord = vi.fn().mockResolvedValue(undefined);
    await moveProjectToStatus(updateRecord, 'project-1', 'active');
    expect(updateRecord).toHaveBeenCalledTimes(1);
    expect(updateRecord).toHaveBeenCalledWith('project-1', { status: 'active' });
  });

  it('renders four columns and offers a keyboard-friendly status control', () => {
    const snapshot = buildInitialSnapshot();
    const projects = snapshot.records.filter((record) => record.typeId === 'project');
    const onMove = vi.fn();
    render(
      <ProjectBoard
        projects={projects}
        allRecords={snapshot.records}
        todoTypeId="todo"
        onMove={onMove}
      />,
    );
    expect(screen.getAllByRole('region')).toHaveLength(4);
    fireEvent.change(screen.getByLabelText(`移动「${projects[0].title}」到状态`), {
      target: { value: 'paused' },
    });
    expect(onMove).toHaveBeenCalledWith(projects[0].id, 'paused');
  });
});
