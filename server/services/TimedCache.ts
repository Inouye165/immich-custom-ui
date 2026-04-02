interface CacheEntry<TValue> {
  value: TValue;
  expiresAt: number;
}

export class TimedCache<TValue> {
  private readonly entries = new Map<string, CacheEntry<TValue>>();

  private readonly pending = new Map<string, Promise<TValue>>();

  private readonly ttlMs: number;

  private readonly maxEntries: number;

  constructor(ttlMs: number, maxEntries = 200) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  get(key: string): TValue | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: TValue) {
    this.pruneExpired();
    if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey) {
        this.entries.delete(oldestKey);
      }
    }

    this.entries.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  async getOrCreate(key: string, loader: () => Promise<TValue>): Promise<TValue> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const existingRequest = this.pending.get(key);
    if (existingRequest) {
      return existingRequest;
    }

    const request = loader()
      .then((value) => {
        this.set(key, value);
        this.pending.delete(key);
        return value;
      })
      .catch((error) => {
        this.pending.delete(key);
        throw error;
      });

    this.pending.set(key, request);
    return request;
  }

  private pruneExpired() {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= Date.now()) {
        this.entries.delete(key);
      }
    }
  }
}