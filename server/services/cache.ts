type CacheValue = unknown;

class MemoryCache {
  private store = new Map<string, CacheValue>();

  get<T = CacheValue>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  set<T = CacheValue>(key: string, value: T): void {
    this.store.set(key, value);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }
}

export const cache = new MemoryCache();
