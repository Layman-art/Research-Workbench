import { useEffect } from 'react';
import type { MotionMode, ThemeMode } from '../../domain/models';
import { resolveReducedMotion, resolveTheme } from './theme';

export function useAppearance(theme: ThemeMode, motion: MotionMode) {
  useEffect(() => {
    const dark = window.matchMedia('(prefers-color-scheme: dark)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      const root = document.documentElement;
      root.dataset.theme = resolveTheme(theme, dark.matches);
      root.dataset.motion = resolveReducedMotion(motion, reduced.matches) ? 'reduce' : 'full';
      root.style.colorScheme = root.dataset.theme;
    };
    apply();
    dark.addEventListener('change', apply);
    reduced.addEventListener('change', apply);
    return () => {
      dark.removeEventListener('change', apply);
      reduced.removeEventListener('change', apply);
    };
  }, [motion, theme]);
}
