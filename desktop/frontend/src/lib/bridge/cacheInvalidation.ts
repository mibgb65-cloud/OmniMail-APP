const listeners = new Set<() => void>();
let revision = 0;
export const cacheRevision = () => revision;
export function subscribeCache(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function notifyCacheCleared() {
  revision++;
  listeners.forEach((listener) => listener());
}
