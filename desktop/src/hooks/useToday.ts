import { useSyncExternalStore } from 'react';
import { formatDate } from '../utils';

// One clock for the whole app. Date-only consumers do not render every minute.
let currentTime = Date.now();
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function refresh() {
  currentTime = Date.now();
  for (const listener of listeners) listener();
  if (timer) clearTimeout(timer);
  if (!listeners.size) return;
  const midnight = new Date(currentTime);
  midnight.setHours(24, 0, 0, 0);
  const nextMinute = 60_000 - currentTime % 60_000;
  timer = setTimeout(refresh, Math.max(1, Math.min(nextMinute, midnight.getTime() - currentTime)));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    refresh();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearTimeout(timer);
      timer = undefined;
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    }
  };
}

export function useNow(): number {
  return useSyncExternalStore(subscribe, () => currentTime, () => currentTime);
}

export function useToday(): string {
  return useSyncExternalStore(subscribe, () => formatDate(currentTime), () => formatDate(currentTime));
}

/** Calendar arithmetic also works through DST changes. */
export function dayDifference(date: string, today: string): number {
  const utc = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((utc(date) - utc(today)) / 86_400_000);
}
