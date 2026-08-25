import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TodoItem } from '../components/TodoView';
import { buildInitialSnapshot } from '../repositories';
import { useStore } from '../stores';

const original = useStore.getState();

describe('todo completion motion', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    document.documentElement.dataset.motion = 'full';
    useStore.setState(original, true);
  });

  it('applies the completion state for 180ms before persisting in full motion', async () => {
    vi.useFakeTimers();
    const toggleDone = vi.fn().mockResolvedValue(undefined);
    useStore.setState({ ...original, toggleDone });
    const record = { ...buildInitialSnapshot().records.find((item) => item.typeId === 'todo')!, done: false };
    render(<TodoItem record={record} />);
    fireEvent.click(screen.getByRole('button', { name: '标记为完成' }));
    expect(screen.getByRole('button', { name: '标记为完成' }).closest('.todo-item')).toHaveClass('is-completing');
    expect(toggleDone).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(180));
    expect(toggleDone).toHaveBeenCalledWith(record.id);
  });

  it('persists immediately when reduced motion is active', () => {
    document.documentElement.dataset.motion = 'reduce';
    const toggleDone = vi.fn().mockResolvedValue(undefined);
    useStore.setState({ ...original, toggleDone });
    const record = { ...buildInitialSnapshot().records.find((item) => item.typeId === 'todo')!, done: false };
    render(<TodoItem record={record} />);
    fireEvent.click(screen.getByRole('button', { name: '标记为完成' }));
    expect(toggleDone).toHaveBeenCalledWith(record.id);
  });
});
