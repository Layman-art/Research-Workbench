import { describe, expect, it } from 'vitest';
import { resolveReducedMotion, resolveTheme } from '../features/theme/theme';

describe('appearance preferences', () => {
  it('resolves an explicit theme without consulting the system preference', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('follows the system when theme mode is system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('supports full, reduced, and system motion modes', () => {
    expect(resolveReducedMotion('full', true)).toBe(false);
    expect(resolveReducedMotion('reduce', false)).toBe(true);
    expect(resolveReducedMotion('system', true)).toBe(true);
    expect(resolveReducedMotion('system', false)).toBe(false);
  });
});
