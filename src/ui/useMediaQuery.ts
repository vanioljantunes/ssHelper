import { useCallback, useSyncExternalStore } from 'react';

function hasMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

/** Tracks a CSS media query; `fallback` is used where matchMedia is missing (tests, SSR). */
export function useMediaQuery(query: string, fallback: boolean): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!hasMatchMedia()) return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', notify);
      return () => list.removeEventListener('change', notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => (hasMatchMedia() ? window.matchMedia(query).matches : fallback),
    () => fallback,
  );
}
