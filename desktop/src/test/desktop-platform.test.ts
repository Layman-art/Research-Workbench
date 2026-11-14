import { describe, expect, it, vi } from 'vitest';
import { createBrowserDesktopPlatform } from '../platform/browserDesktopPlatform';
import { assertBadgeCount } from '../platform/DesktopPlatform';

describe('browserDesktopPlatform', () => {
  it('opens only HTTPS external URLs through the injected opener', async () => {
    const opener = vi.fn();
    const platform = createBrowserDesktopPlatform(opener);

    await expect(platform.openExternal('javascript:alert(1)')).rejects.toThrow(
      '只允许打开 HTTPS 链接',
    );
    await platform.openExternal('https://doi.org/10.1/example');

    expect(opener).toHaveBeenCalledWith('https://doi.org/10.1/example');
  });

  it('accepts only non-negative integer badge counts', () => {
    expect(assertBadgeCount(0)).toBe(0);
    expect(assertBadgeCount(3)).toBe(3);
    expect(() => assertBadgeCount(-1)).toThrow();
    expect(() => assertBadgeCount(1.5)).toThrow();
  });

  it('returns false for desktop-only settings in browser preview', async () => {
    const platform = createBrowserDesktopPlatform(vi.fn());

    await expect(platform.getAutoLaunch()).resolves.toBe(false);
    await expect(platform.setAutoLaunch(true)).resolves.toBe(false);
    await expect(platform.getCloseToTray()).resolves.toBe(false);
    await expect(platform.setCloseToTray(true)).resolves.toBe(false);
  });
});
