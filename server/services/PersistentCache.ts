import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { TimedCache } from './TimedCache';

export type CacheSource = 'disk-cache' | 'live' | 'memory-cache';

interface CacheEnvelope<TValue> {
  expiresAt: number;
  value: TValue;
}

export interface CacheLookupResult<TValue> {
  source: CacheSource;
  value: TValue;
}

export class PersistentCache<TValue> {
  private readonly memoryCache: TimedCache<TValue>;

  private readonly pending = new Map<string, Promise<CacheLookupResult<TValue>>>();

  private readonly cacheDir: string;

  private readonly ttlMs: number;

  constructor(namespace: string, ttlMs: number, maxEntries = 200) {
    this.ttlMs = ttlMs;
    this.memoryCache = new TimedCache<TValue>(ttlMs, maxEntries);
    this.cacheDir = path.join(process.cwd(), '.runtime', 'api-cache', namespace);
  }

  async get(key: string): Promise<CacheLookupResult<TValue> | null> {
    const memoryValue = this.memoryCache.get(key);
    if (memoryValue !== undefined) {
      return {
        source: 'memory-cache',
        value: memoryValue,
      };
    }

    const filePath = this.getFilePath(key);
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const envelope = JSON.parse(raw) as CacheEnvelope<TValue>;
      if (envelope.expiresAt <= Date.now()) {
        await fs.rm(filePath, { force: true });
        return null;
      }

      this.memoryCache.set(key, envelope.value);
      return {
        source: 'disk-cache',
        value: envelope.value,
      };
    } catch {
      return null;
    }
  }

  async set(key: string, value: TValue) {
    this.memoryCache.set(key, value);
    await fs.mkdir(this.cacheDir, { recursive: true });
    const envelope: CacheEnvelope<TValue> = {
      expiresAt: Date.now() + this.ttlMs,
      value,
    };
    await fs.writeFile(this.getFilePath(key), JSON.stringify(envelope), 'utf8');
  }

  async getOrCreate(
    key: string,
    loader: () => Promise<TValue>,
  ): Promise<CacheLookupResult<TValue>> {
    const cached = await this.get(key);
    if (cached) {
      return cached;
    }

    const pending = this.pending.get(key);
    if (pending) {
      return pending;
    }

    const request = loader()
      .then(async (value) => {
        await this.set(key, value);
        this.pending.delete(key);
        return {
          source: 'live' as const,
          value,
        };
      })
      .catch((error) => {
        this.pending.delete(key);
        throw error;
      });

    this.pending.set(key, request);
    return request;
  }

  private getFilePath(key: string) {
    const hash = createHash('sha1').update(key).digest('hex');
    return path.join(this.cacheDir, `${hash}.json`);
  }
}