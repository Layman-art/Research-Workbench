import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InMemoryWorkbenchRepository } from '../repositories/InMemoryWorkbenchRepository';
import { buildInitialSnapshot } from '../repositories';
import { useRecordDraft } from '../features/drafts/useRecordDraft';

describe('useRecordDraft', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces changed payloads and offers the saved draft on remount', async () => {
    vi.useFakeTimers();
    const repository = new InMemoryWorkbenchRepository(buildInitialSnapshot());
    const initialPayload = JSON.stringify({ title: '实验', content: '' });
    const changedPayload = JSON.stringify({ title: '实验', content: '# 新结果' });
    const { rerender, unmount } = renderHook(
      ({ payload }) =>
        useRecordDraft({
          draftId: 'record:sample-1',
          recordId: 'sample-1',
          initialPayload,
          payload,
          repository,
          debounceMs: 500,
        }),
      { initialProps: { payload: initialPayload } },
    );
    rerender({ payload: changedPayload });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect((await repository.loadDraft('record:sample-1'))?.payload).toBe(changedPayload);
    unmount();

    const recovered = renderHook(() =>
      useRecordDraft({
        draftId: 'record:sample-1',
        recordId: 'sample-1',
        initialPayload,
        payload: initialPayload,
        repository,
        debounceMs: 500,
      }),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(recovered.result.current.recoveredPayload).toBe(changedPayload);
    await recovered.result.current.discard();
    expect(await repository.loadDraft('record:sample-1')).toBeNull();
  });
});
