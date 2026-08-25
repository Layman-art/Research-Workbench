import { useCallback, useEffect, useState } from 'react';

export function useRecordSelection(visibleIds: string[]) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const visibleKey = visibleIds.join('\u0000');

  useEffect(() => {
    const visible = new Set(visibleKey ? visibleKey.split('\u0000') : []);
    setSelected((current) => {
      const next = new Set([...current].filter((id) => visible.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [visibleKey]);

  const enter = useCallback(() => setSelecting(true), []);
  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const selectVisible = useCallback(() => {
    setSelecting(true);
    setSelected(new Set(visibleKey ? visibleKey.split('\u0000') : []));
  }, [visibleKey]);
  const clear = useCallback(() => {
    setSelected(new Set());
    setSelecting(false);
  }, []);

  return { selecting, selected, enter, toggle, selectVisible, clear };
}
