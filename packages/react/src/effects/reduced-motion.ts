import React from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

const read = () => typeof window !== 'undefined' && !!window.matchMedia?.(QUERY).matches;

/** The viewer's `prefers-reduced-motion: reduce`, live. `false` on the server. */
export function usePrefersReducedMotion(): boolean {
  return React.useSyncExternalStore(subscribe, read, () => false);
}
