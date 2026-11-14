import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useNow, useToday } from '../hooks/useToday';
import { ScheduleView } from '../components/ScheduleView';
import { buildInitialSnapshot } from '../repositories';
import { useStore } from '../stores';

const original = useStore.getState();
function Clock() { const today = useToday(); const now = useNow(); return <output>{today} {new Date(now).getHours()}</output>; }
afterEach(() => { cleanup(); vi.useRealTimers(); useStore.setState(original, true); });
describe('long-running desktop calendar', () => {
  it('refreshes at midnight across a year and shares one timer', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 11, 31, 23, 59, 59, 900));
    const { unmount } = render(<Clock />);
    expect(screen.getByRole('status')).toHaveTextContent('2026-12-31 23');
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByRole('status')).toHaveTextContent('2027-01-01 0');
    unmount(); expect(vi.getTimerCount()).toBe(0);
  });
  it('catches up immediately on focus and visibility after suspension', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 14, 9)); render(<Clock />);
    vi.setSystemTime(new Date(2026, 10, 17, 10)); fireEvent(window, new Event('focus'));
    expect(screen.getByRole('status')).toHaveTextContent('2026-11-17 10');
    vi.setSystemTime(new Date(2026, 11, 1, 8)); fireEvent(document, new Event('visibilitychange'));
    expect(screen.getByRole('status')).toHaveTextContent('2026-12-01 8');
  });
  it('advances the current week on Monday but preserves explicit historical navigation', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 15, 23, 59, 59));
    const snapshot = buildInitialSnapshot();
    useStore.setState({ ...original, ...snapshot, records: [] });
    render(<ScheduleView typeId={snapshot.types.find((t) => t.kind === 'schedule')!.id} />);
    expect(screen.getByLabelText('跳转到日期')).toHaveValue('2026-11-15');
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByLabelText('跳转到日期')).toHaveValue('2026-11-16');
    fireEvent.change(screen.getByLabelText('跳转到日期'), { target: { value: '2025-03-01' } });
    vi.setSystemTime(new Date(2026, 10, 20)); fireEvent(window, new Event('focus'));
    expect(screen.getByLabelText('跳转到日期')).toHaveValue('2025-03-01');
    fireEvent.click(screen.getByRole('button', { name: '回到今天' }));
    expect(screen.getByLabelText('跳转到日期')).toHaveValue('2026-11-20');
  });
});
