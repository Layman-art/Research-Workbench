import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RecurrenceFields } from '../features/todos/RecurrenceFields';

describe('RecurrenceFields', () => {
  it('produces a two-week recurrence rule and readable preview', () => {
    const onChange = vi.fn();
    const { rerender } = render(<RecurrenceFields value={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('重复频率'), { target: { value: 'weekly' } });
    expect(onChange).toHaveBeenLastCalledWith({ frequency: 'weekly', interval: 1 });

    rerender(<RecurrenceFields value={{ frequency: 'weekly', interval: 1 }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('重复间隔'), { target: { value: '2' } });
    expect(onChange).toHaveBeenLastCalledWith({ frequency: 'weekly', interval: 2 });

    rerender(<RecurrenceFields value={{ frequency: 'weekly', interval: 2 }} onChange={onChange} />);
    expect(screen.getByText('每 2 周重复')).toBeInTheDocument();
  });
});
