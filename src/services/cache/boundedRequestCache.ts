interface CacheEntry {
  expiresAt: number | null;
  promise: Promise<unknown>;
}

export class BoundedRequestCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(private readonly maxEntries = 64) {}

  getOrLoad<T>(key: string, ttlMilliseconds: number, loader: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const existing = this.entries.get(key);
    if (existing && (existing.expiresAt === null || existing.expiresAt > now)) {
      return existing.promise as Promise<T>;
    }
    if (existing) this.entries.delete(key);

    this.pruneExpired(now);
    this.evictResolvedEntryAtCapacity();

    const promise = loader();
    if (this.entries.size >= this.maxEntries) return promise;

    const entry: CacheEntry = { expiresAt: null, promise };
    this.entries.set(key, entry);
    void promise.then(
      () => {
        if (this.entries.get(key) === entry) entry.expiresAt = Date.now() + ttlMilliseconds;
      },
      () => {
        if (this.entries.get(key) === entry) this.entries.delete(key);
      }
    );
    return promise;
  }

  private pruneExpired(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt !== null && entry.expiresAt <= now) this.entries.delete(key);
    }
  }

  private evictResolvedEntryAtCapacity(): void {
    if (this.entries.size < this.maxEntries) return;
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt !== null) {
        this.entries.delete(key);
        return;
      }
    }
  }
}
