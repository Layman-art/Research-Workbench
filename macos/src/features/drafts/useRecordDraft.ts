import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkbenchRepository } from '../../repositories/WorkbenchRepository';

interface UseRecordDraftOptions {
  draftId: string;
  recordId: string | null;
  initialPayload: string;
  payload: string;
  repository: WorkbenchRepository;
  debounceMs?: number;
}

export function useRecordDraft({
  draftId,
  recordId,
  initialPayload,
  payload,
  repository,
  debounceMs = 500,
}: UseRecordDraftOptions) {
  const [recoveredPayload, setRecoveredPayload] = useState<string | null>(null);
  const discarded = useRef(false);

  useEffect(() => {
    let active = true;
    void repository.loadDraft(draftId).then((draft) => {
      if (active && draft && draft.payload !== initialPayload) setRecoveredPayload(draft.payload);
    });
    return () => {
      active = false;
    };
  }, [draftId, initialPayload, repository]);

  useEffect(() => {
    if (payload === initialPayload) return;
    discarded.current = false;
    const timer = window.setTimeout(() => {
      if (!discarded.current) {
        void repository.saveDraft({ id: draftId, recordId, payload, updatedAt: Date.now() });
      }
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [debounceMs, draftId, initialPayload, payload, recordId, repository]);

  const discard = useCallback(async () => {
    discarded.current = true;
    await repository.deleteDraft(draftId);
    setRecoveredPayload(null);
  }, [draftId, repository]);

  return {
    recoveredPayload,
    clearRecovered: () => setRecoveredPayload(null),
    discard,
  };
}
