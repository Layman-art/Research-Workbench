import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRecordSelection } from '../features/selection/useRecordSelection';

describe('useRecordSelection', () => {
  it('selects one, selects visible results, clears, and prunes hidden IDs', () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useRecordSelection(ids),
      { initialProps: { ids: ['a', 'b', 'c'] } },
    );
    act(() => result.current.enter());
    act(() => result.current.toggle('a'));
    expect([...result.current.selected]).toEqual(['a']);
    act(() => result.current.selectVisible());
    expect([...result.current.selected]).toEqual(['a', 'b', 'c']);

    rerender({ ids: ['b', 'c'] });
    expect([...result.current.selected]).toEqual(['b', 'c']);
    act(() => result.current.clear());
    expect(result.current.selected.size).toBe(0);
    expect(result.current.selecting).toBe(false);
  });
});
