import type { MotionMode, ThemeMode } from '../../domain/models';

export type ResolvedTheme = 'light' | 'dark';

export function resolveTheme(mode: ThemeMode, systemDark: boolean): ResolvedTheme {
  return mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
}

export function resolveReducedMotion(mode: MotionMode, systemReduced: boolean): boolean {
  return mode === 'system' ? systemReduced : mode === 'reduce';
}
