import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { selectProjectNextActions } from '../store/selectors';
import { ProjectNextActions } from '../features/projects/ProjectNextActions';
import { buildInitialSnapshot } from '../repositories';
import { EDITOR_EVENT, type EditorRequest } from '../editorBus';

describe('project next actions', () => {
  it('selects incomplete actions by overdue, due date, then priority', () => {
    const base = buildInitialSnapshot().records.find((record) => record.typeId === 'todo')!;
    const records = [
      { ...base, id: 'late-low', projectId: 'p1', dueDate: '2026-08-16', priority: 'low' as const, done: false },
      { ...base, id: 'future-high', projectId: 'p1', dueDate: '2026-08-20', priority: 'high' as const, done: false },
      { ...base, id: 'future-low', projectId: 'p1', dueDate: '2026-08-20', priority: 'low' as const, done: false },
      { ...base, id: 'done', projectId: 'p1', dueDate: '2026-08-15', done: true },
    ];
    expect(selectProjectNextActions(records, 'p1', '2026-08-17').map((record) => record.id)).toEqual([
      'late-low', 'future-high', 'future-low',
    ]);
  });

  it('opens a linked todo from a project card', () => {
    const action = { ...buildInitialSnapshot().records.find((record) => record.typeId === 'todo')!, id: 'action-1', projectId: 'p1', title: '整理实验数据', done: false };
    const listener = vi.fn<(event: Event) => void>();
    window.addEventListener(EDITOR_EVENT, listener);
    render(<ProjectNextActions records={[action]} projectId="p1" />);

    fireEvent.click(screen.getByRole('button', { name: '整理实验数据' }));

    expect((listener.mock.calls[0][0] as CustomEvent<EditorRequest>).detail).toEqual({ recordId: 'action-1' });
    window.removeEventListener(EDITOR_EVENT, listener);
  });
});
