import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorModal } from '../components/EditorModal';
import { buildInitialSnapshot, workbenchRepository } from '../repositories';
import { useStore } from '../stores';
import { flushPendingDrafts, hasPendingDrafts } from '../features/drafts/draftLifecycle';

async function openEditor(request = { typeId: 'note' }) {
  const onClose = vi.fn();
  const view = render(<EditorModal request={request} onClose={onClose} />);
  await waitFor(() => expect(screen.getByRole('button', { name: '创建记录' })).toBeEnabled());
  return { ...view, onClose };
}

function writeNote() {
  fireEvent.change(screen.getByPlaceholderText('给这条记录起个名字'), { target: { value: '可靠保存的心得' } });
  fireEvent.change(screen.getByPlaceholderText('记录细节、心得、实验命令、结果与链接……'), { target: { value: '# 长笔记\n不会丢失的内容。'.repeat(100) } });
}

describe('editor persistence and recovery', () => {
  beforeEach(async () => {
    await workbenchRepository.initialize();
    await workbenchRepository.replaceAll(buildInitialSnapshot());
    for (const draft of await workbenchRepository.listDrafts()) await workbenchRepository.deleteDraft(draft.id);
    await useStore.getState().hydrate();
    useStore.getState().setWorkspaceFilter('all');
  });
  afterEach(async () => {
    await act(async () => { cleanup(); await Promise.resolve(); });
    vi.restoreAllMocks();
  });

  it('keeps text and exposes persistence errors; retry creates only one record', async () => {
    const saveRecord = vi.spyOn(workbenchRepository, 'saveRecord').mockRejectedValueOnce(new Error('磁盘无法写入'));
    const { onClose } = await openEditor();
    writeNote();
    fireEvent.click(screen.getByRole('button', { name: '创建记录' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('保存失败');
    expect((screen.getByPlaceholderText('记录细节、心得、实验命令、结果与链接……') as HTMLTextAreaElement).value).toContain('不会丢失');
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '创建记录' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(saveRecord).toHaveBeenCalledTimes(2);
    expect(saveRecord.mock.calls[0][0].id).toBe(saveRecord.mock.calls[1][0].id);
    expect(useStore.getState().records.filter((record) => record.title === '可靠保存的心得')).toHaveLength(1);
  });

  it('does not create a second record if cleanup fails after a successful save', async () => {
    const { onClose } = await openEditor();
    writeNote();
    vi.spyOn(workbenchRepository, 'deleteDraft').mockRejectedValueOnce(new Error('草稿清理失败'));
    fireEvent.click(screen.getByRole('button', { name: '创建记录' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('记录已保存');
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(useStore.getState().records.filter((record) => record.title === '可靠保存的心得')).toHaveLength(1);
  });

  it('inherits the active workspace for new notes', async () => {
    await useStore.getState().addWorkspace('第二工作区');
    const workspace = useStore.getState().workspaces.find((item) => item.name === '第二工作区')!;
    useStore.getState().setWorkspaceFilter(workspace.id);
    const { onClose } = await openEditor();
    writeNote();
    fireEvent.click(screen.getByRole('button', { name: '创建记录' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(useStore.getState().records.find((record) => record.title === '可靠保存的心得')?.workspaceId).toBe(workspace.id);
  });

  it('waits for an active record commit before permitting native exit', async () => {
    const original = workbenchRepository.saveRecord.bind(workbenchRepository);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    vi.spyOn(workbenchRepository, 'saveRecord').mockImplementation(async (record) => {
      await gate;
      await original(record);
    });
    const { onClose } = await openEditor();
    writeNote();
    fireEvent.click(screen.getByRole('button', { name: '创建记录' }));
    expect(hasPendingDrafts()).toBe(true);
    let exited = false;
    const flush = flushPendingDrafts().then(() => { exited = true; });
    await act(async () => { await Promise.resolve(); });
    expect(exited).toBe(false);
    await act(async () => { release(); await flush; });
    expect(exited).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(hasPendingDrafts()).toBe(false);
  });

  it('rejects native exit when the unsaved draft cannot be persisted', async () => {
    const saveDraft = vi.spyOn(workbenchRepository, 'saveDraft').mockRejectedValue(new Error('草稿写入失败'));
    await openEditor();
    writeNote();
    await act(async () => { await expect(flushPendingDrafts()).rejects.toThrow('草稿写入失败'); });
    expect(hasPendingDrafts()).toBe(true);
    expect(screen.getByRole('alert')).toHaveTextContent('草稿保存失败');
    saveDraft.mockRestore();
    await act(async () => { await flushPendingDrafts(); });
    expect(await workbenchRepository.listDrafts()).toHaveLength(1);
  });

  it('recovers a new untitled draft after remount using its listed draft ID', async () => {
    const { unmount } = await openEditor();
    fireEvent.change(screen.getByPlaceholderText('记录细节、心得、实验命令、结果与链接……'), { target: { value: '无标题也需要恢复的正文' } });
    await act(async () => { await flushPendingDrafts(); });
    const drafts = await workbenchRepository.listDrafts();
    expect(drafts).toHaveLength(1);
    unmount();
    render(<EditorModal request={{ draftId: drafts[0].id }} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: '恢复草稿' }));
    expect(screen.getByPlaceholderText('记录细节、心得、实验命令、结果与链接……')).toHaveValue('无标题也需要恢复的正文');
  });

  it('Ctrl+S saves once and ignores keys during IME composition', async () => {
    const { onClose } = await openEditor();
    writeNote();
    fireEvent.keyDown(window, { key: 's', ctrlKey: true, isComposing: true });
    await act(async () => { await Promise.resolve(); });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(useStore.getState().records.filter((record) => record.title === '可靠保存的心得')).toHaveLength(1);
  });

  it('refuses a schedule ending before its start while retaining the form', async () => {
    const { container, onClose } = await openEditor({ typeId: 'schedule' });
    writeNote();
    // The modal is a portal, so inspect the real document instead of the render container.
    expect(container).toBeInTheDocument();
    const times = document.querySelectorAll<HTMLInputElement>('input[type="time"]');
    fireEvent.change(times[0], { target: { value: '15:00' } });
    fireEvent.change(times[1], { target: { value: '14:00' } });
    fireEvent.click(screen.getByRole('button', { name: '创建记录' }));
    expect(screen.getByRole('alert')).toHaveTextContent('结束时间不能早于开始时间');
    expect(onClose).not.toHaveBeenCalled();
  });
  it('blocks editing after a draft read failure and permits retry without overwriting it', async () => {
    const load = vi.spyOn(workbenchRepository, 'loadDraft').mockRejectedValueOnce(new Error('无法读取旧草稿'));
    const save = vi.spyOn(workbenchRepository, 'saveDraft');
    render(<EditorModal request={{ typeId: 'note' }} onClose={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('草稿读取失败');
    expect(screen.getByRole('button', { name: '创建记录' })).toBeDisabled();
    expect(screen.getByPlaceholderText('给这条记录起个名字')).toBeDisabled();
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '重试草稿' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '创建记录' })).toBeEnabled());
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('reopening a draft after its record committed updates that record instead of duplicating it', async () => {
    const { unmount } = await openEditor();
    writeNote();
    await act(async () => { await flushPendingDrafts(); });
    const [draft] = await workbenchRepository.listDrafts();
    vi.spyOn(workbenchRepository, 'deleteDraft').mockRejectedValueOnce(new Error('清理失败'));
    fireEvent.click(screen.getByRole('button', { name: '创建记录' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('记录已保存');
    unmount();
    const onClose = vi.fn();
    render(<EditorModal request={{ draftId: draft.id }} onClose={onClose} />);
    await waitFor(() => expect(screen.getByRole('button', { name: '保存修改' })).toBeEnabled());
    fireEvent.change(screen.getByPlaceholderText('给这条记录起个名字'), { target: { value: '恢复后改过的标题' } });
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(useStore.getState().records.filter((record) => record.id === draft.id.slice(4))).toHaveLength(1);
    expect(useStore.getState().records.find((record) => record.id === draft.id.slice(4))?.title).toBe('恢复后改过的标题');
  });

});
