import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScheduleView } from '../components/ScheduleView';
import { buildInitialSnapshot } from '../repositories';
import { EDITOR_EVENT, type EditorRequest } from '../editorBus';
import { useStore } from '../stores';

const original = useStore.getState();

describe('ScheduleView', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useStore.setState(original, true);
  });

  it('renders a compact dashboard preview that opens schedule management', () => {
    const snapshot = buildInitialSnapshot();
    const scheduleType = snapshot.types.find((type) => type.kind === 'schedule')!;
    useStore.setState({ ...original, ...snapshot, view: 'dashboard' });

    const { container } = render(<ScheduleView typeId={scheduleType.id} embedded />);

    expect(screen.getByRole('heading', { name: '近期日程' })).toBeInTheDocument();
    expect(container.querySelector('.week-grid')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '进入日程管理' }));
    expect(useStore.getState().view).toBe(scheduleType.id);
  });

  it('keeps the weekly planning views on the management page', () => {
    const snapshot = buildInitialSnapshot();
    const scheduleType = snapshot.types.find((type) => type.kind === 'schedule')!;
    useStore.setState({ ...original, ...snapshot });

    const { container } = render(<ScheduleView typeId={scheduleType.id} />);

    expect(screen.getByRole('button', { name: '周网格' })).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('.week-grid')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '议程' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '近期' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '历史' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '全部' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '月历' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '周清单' }));

    expect(screen.getByRole('button', { name: '周清单' })).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('.week-grid')).not.toBeInTheDocument();
    expect(container.querySelector('.week-list')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /在.*安排日程/ })).toHaveLength(7);

    fireEvent.click(screen.getByRole('button', { name: '月历' }));
    expect(container.querySelector('.month-grid')).toBeInTheDocument();
  });

  it('filters the full schedule list and exposes edit and delete actions', async () => {
    const snapshot = buildInitialSnapshot();
    const scheduleType = snapshot.types.find((type) => type.kind === 'schedule')!;
    const template = snapshot.records.find((record) => record.typeId === scheduleType.id)!;
    const past = { ...template, id: 'past-plan', title: '过往讨论', planDate: '2020-01-02' };
    const future = { ...template, id: 'future-plan', title: '未来讨论', planDate: '2099-03-04' };
    const deleteRecord = vi.fn().mockResolvedValue(undefined);
    useStore.setState({
      ...original,
      ...snapshot,
      records: [past, future],
      deleteRecord,
    });
    const listener = vi.fn<(event: Event) => void>();
    window.addEventListener(EDITOR_EVENT, listener);

    const { container } = render(<ScheduleView typeId={scheduleType.id} />);
    const manager = within(container.querySelector('.schedule-manager-list')!);

    // 默认「近期」：2099 太远、2020 已过去，都不显示
    expect(manager.queryByText('未来讨论')).not.toBeInTheDocument();
    expect(manager.queryByText('过往讨论')).not.toBeInTheDocument();

    // 「历史」：显示过往讨论
    fireEvent.click(screen.getByRole('button', { name: '历史' }));
    expect(manager.getByText('过往讨论')).toBeInTheDocument();
    expect(manager.queryByText('未来讨论')).not.toBeInTheDocument();

    fireEvent.click(manager.getByRole('button', { name: '编辑 过往讨论' }));
    expect((listener.mock.calls[0][0] as CustomEvent<EditorRequest>).detail).toEqual({ recordId: 'past-plan' });

    // 模拟 App 层的确认对话框宿主：自动批准确认请求。
    const confirmListener = (event: Event) => {
      const request = (event as CustomEvent<{ resolve: (v: boolean) => void }>).detail;
      request.resolve(true);
    };
    window.addEventListener('rw:confirm', confirmListener);
    fireEvent.click(manager.getByRole('button', { name: '删除 过往讨论' }));
    await vi.waitFor(() => expect(deleteRecord).toHaveBeenCalledWith('past-plan'));
    window.removeEventListener('rw:confirm', confirmListener);
    window.removeEventListener(EDITOR_EVENT, listener);
  });
});
