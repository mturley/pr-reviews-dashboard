// Simple in-memory TTL cache for API responses

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (entry && Date.now() < entry.expiresAt) {
    return Promise.resolve(entry.data);
  }
  return fn().then((data) => {
    store.set(key, { data, expiresAt: Date.now() + ttlMs });
    return data;
  });
}

export function invalidate(key: string): void {
  store.delete(key);
}
