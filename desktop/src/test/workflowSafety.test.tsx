import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TodoView } from '../components/TodoView';
import { Sidebar } from '../components/Sidebar';
import { buildInitialSnapshot } from '../repositories';
import { useStore } from '../stores';
import { countRecordsByType, filterRecords } from '../store/selectors';
const original = useStore.getState();
afterEach(() => { cleanup(); vi.restoreAllMocks(); useStore.setState(original, true); });
it('does not create a task while confirming Chinese IME text', async () => {
  const snapshot = buildInitialSnapshot(); const type = snapshot.types.find((t) => t.kind === 'todo')!;
  const addRecord = vi.fn().mockResolvedValue({});
  useStore.setState({ ...original, ...snapshot, records: [], addRecord });
  render(<TodoView typeId={type.id} />);
  const input = screen.getByPlaceholderText(/添加.*回车创建/);
  fireEvent.change(input, { target: { value: '中文待办' } });
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true, keyCode: 229 });
  expect(addRecord).not.toHaveBeenCalled();
  await act(async () => { fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 }); });
  expect(addRecord).toHaveBeenCalledTimes(1);
});
it('excludes trash from normal search, archive and type counts', () => {
  const snapshot = buildInitialSnapshot(); const record = snapshot.records[0];
  const records = [{ ...record, title: 'deleted', deletedAt: 123, archived: true }];
  for (const status of ['all', 'archived']) expect(filterRecords({ records, workspaceId: 'all', status, query: '' })).toEqual([]);
  expect(countRecordsByType(records, snapshot.types)[record.typeId]).toBe(0);
});
it('highlights archive independently of dashboard', () => {
  useStore.setState({ ...original, ...buildInitialSnapshot(), view: 'dashboard', statusFilter: 'archived' });
  render(<Sidebar />);
  expect(screen.getByRole('button', { name: /已归档/ })).toHaveClass('active');
  expect(screen.getByRole('button', { name: '工作台总览' })).not.toHaveClass('active');
});
