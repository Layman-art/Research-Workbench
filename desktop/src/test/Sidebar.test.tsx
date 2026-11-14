import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Sidebar } from '../components/Sidebar';
import { buildInitialSnapshot } from '../repositories';
import { useStore } from '../stores';

const original = useStore.getState();

describe('Sidebar schedule navigation', () => {
  afterEach(() => {
    cleanup();
    useStore.setState(original, true);
  });

  it('exposes the schedule page and navigates to it', () => {
    const snapshot = buildInitialSnapshot();
    const schedule = snapshot.types.find((type) => type.kind === 'schedule')!;
    useStore.setState({
      ...original,
      ...snapshot,
      view: 'dashboard',
      statusFilter: 'done',
    });

    render(<Sidebar />);
    fireEvent.click(screen.getByRole('button', { name: /^日程安排/ }));

    expect(useStore.getState().view).toBe(schedule.id);
    expect(useStore.getState().statusFilter).toBe('all');
  });
});
