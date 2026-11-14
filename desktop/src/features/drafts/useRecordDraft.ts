import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkbenchRepository } from '../../repositories/WorkbenchRepository';
import { notifyDraftsChanged, registerDraftHandler } from './draftLifecycle';

interface UseRecordDraftOptions {
  draftId: string;
  recordId: string | null;
  initialPayload: string;
  payload: string;
  repository: WorkbenchRepository;
  debounceMs?: number;
}

export function useRecordDraft({
  draftId, recordId, initialPayload, payload, repository, debounceMs = 500,
}: UseRecordDraftOptions) {
  const [recoveredPayload, setRecoveredPayload] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const latest = useRef(payload);
  const baseline = useRef(initialPayload);
  const persisted = useRef(initialPayload);
  const recovered = useRef<string | null>(null);
  const loadFailure = useRef(false);
  const discarded = useRef(false);
  const mounted = useRef(true);
  const timer = useRef<number | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const activeFlush = useRef<Promise<void> | null>(null);
  latest.current = payload;

  const clearTimer = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const reportError = useCallback((reason: unknown) => {
    if (!mounted.current) return;
    setStatus('error');
    setError(reason instanceof Error ? reason.message : String(reason));
  }, []);

  const flush = useCallback(async () => {
    clearTimer();
    if (discarded.current || latest.current === baseline.current) return queue.current;
    if (loadFailure.current) throw new Error('草稿读取失败，已停止覆盖写入；请先重试读取');
    if (recovered.current !== null) throw new Error('请先恢复或忽略已有草稿');
    if (activeFlush.current) return activeFlush.current;
    const operation = queue.current.catch(() => undefined).then(async () => {
      while (!discarded.current && latest.current !== persisted.current && latest.current !== baseline.current) {
        const pendingPayload = latest.current;
        if (mounted.current) {
          setStatus('saving');
          setError(null);
        }
        const updatedAt = Date.now();
        await repository.saveDraft({ id: draftId, recordId, payload: pendingPayload, updatedAt });
        persisted.current = pendingPayload;
        if (mounted.current) {
          setStatus('saved');
          setSavedAt(updatedAt);
        }
        notifyDraftsChanged();
      }
    });
    queue.current = operation;
    activeFlush.current = operation;
    try {
      await operation;
    } catch (reason) {
      reportError(reason);
      throw reason;
    } finally {
      activeFlush.current = null;
    }
  }, [clearTimer, draftId, recordId, repository, reportError]);

  useEffect(() => {
    let active = true;
    void repository.loadDraft(draftId).then((draft) => {
      if (!active) return;
      loadFailure.current = false;
      setLoadFailed(false);
      setError(null);
      setStatus('idle');
      if (draft && draft.payload !== initialPayload) {
        recovered.current = draft.payload;
        persisted.current = draft.payload;
        setRecoveredPayload(draft.payload);
        setSavedAt(draft.updatedAt);
      }
    }).catch((reason) => {
      if (!active) return;
      loadFailure.current = true;
      setLoadFailed(true);
      reportError(reason);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [draftId, initialPayload, repository, reportError, reloadVersion]);

  useEffect(() => {
    if (loading || loadFailed || recoveredPayload || payload === baseline.current) return;
    discarded.current = false;
    timer.current = window.setTimeout(() => { void flush().catch(() => undefined); }, debounceMs);
    return clearTimer;
  }, [clearTimer, debounceMs, flush, loadFailed, loading, payload, recoveredPayload]);

  useEffect(() => {
    mounted.current = true;
    const unregister = registerDraftHandler({
      flush,
      isPending: () => !discarded.current && latest.current !== baseline.current,
    });
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void flush().catch(() => undefined);
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!discarded.current && latest.current !== persisted.current && latest.current !== baseline.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      mounted.current = false;
      unregister();
      clearTimer();
      void flush().catch(() => undefined);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [clearTimer, flush]);

  const discard = useCallback(async () => {
    clearTimer();
    discarded.current = true;
    const operation = queue.current.catch(() => undefined).then(() => repository.deleteDraft(draftId));
    queue.current = operation;
    try {
      await operation;
      recovered.current = null;
      persisted.current = baseline.current;
      if (mounted.current) {
        setRecoveredPayload(null);
        setStatus('idle');
        setError(null);
      }
      notifyDraftsChanged();
    } catch (reason) {
      discarded.current = false;
      reportError(reason);
      throw reason;
    }
  }, [clearTimer, draftId, repository, reportError]);

  const markSaved = useCallback(async () => {
    baseline.current = latest.current;
    await discard();
  }, [discard]);

  return {
    recoveredPayload, loading, loadFailed, status, error, savedAt, flush, markSaved,
    retry: async () => {
      if (loadFailure.current) {
        setLoading(true);
        setReloadVersion((version) => version + 1);
      } else await flush();
    },
    clearRecovered: () => {
      recovered.current = null;
      setRecoveredPayload(null);
    },
    discard,
  };
}
