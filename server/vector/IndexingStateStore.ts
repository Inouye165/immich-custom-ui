import { promises as fs } from 'node:fs';
import path from 'node:path';

export type IndexingStatus = 'pending' | 'in-progress' | 'indexed' | 'failed' | 'rate-limited';

export interface DocumentIndexingRecord {
  documentId: number;
  title: string;
  fingerprint: string;
  status: IndexingStatus;
  retryCount: number;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  nextRetryAt: string | null;
}

export interface IndexingSummary {
  pending: number;
  inProgress: number;
  indexed: number;
  failed: number;
  rateLimited: number;
  total: number;
  lastBatchAt: string | null;
  lastBatchResult: string | null;
  nextScheduledBatch: string | null;
}

interface StoreSnapshot {
  records: Record<number, DocumentIndexingRecord>;
  lastBatchAt: string | null;
  lastBatchResult: string | null;
  nextScheduledBatch: string | null;
}

const DEFAULT_SNAPSHOT: StoreSnapshot = {
  records: {},
  lastBatchAt: null,
  lastBatchResult: null,
  nextScheduledBatch: null,
};

/**
 * Lightweight JSON-file persistence for per-document indexing state.
 * Survives restarts and is inspectable by hand.
 */
export class IndexingStateStore {
  private snapshot: StoreSnapshot = structuredClone(DEFAULT_SNAPSHOT);
  private readonly filePath: string;
  private dirty = false;
  private writeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(runtimeDir?: string) {
    const base = runtimeDir ?? path.join(process.cwd(), '.runtime');
    this.filePath = path.join(base, 'indexing-state.json');
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<StoreSnapshot>;
      this.snapshot = {
        records: parsed.records ?? {},
        lastBatchAt: parsed.lastBatchAt ?? null,
        lastBatchResult: parsed.lastBatchResult ?? null,
        nextScheduledBatch: parsed.nextScheduledBatch ?? null,
      };
    } catch {
      this.snapshot = structuredClone(DEFAULT_SNAPSHOT);
    }
  }

  async flush(): Promise<void> {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.snapshot, null, 2));
    this.dirty = false;
  }

  private scheduleSave(): void {
    if (this.writeTimer) return;
    this.dirty = true;
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      this.flush().catch((err) => console.error('[indexing-state] flush failed:', err));
    }, 2000);
  }

  getRecord(docId: number): DocumentIndexingRecord | undefined {
    return this.snapshot.records[docId];
  }

  upsertRecord(record: DocumentIndexingRecord): void {
    this.snapshot.records[record.documentId] = record;
    this.scheduleSave();
  }

  removeRecord(docId: number): void {
    delete this.snapshot.records[docId];
    this.scheduleSave();
  }

  markPending(docId: number, title: string, fingerprint: string): void {
    const existing = this.snapshot.records[docId];
    this.snapshot.records[docId] = {
      documentId: docId,
      title,
      fingerprint,
      status: 'pending',
      retryCount: existing?.retryCount ?? 0,
      lastAttemptAt: existing?.lastAttemptAt ?? null,
      lastSuccessAt: existing?.lastSuccessAt ?? null,
      lastError: null,
      nextRetryAt: null,
    };
    this.scheduleSave();
  }

  markInProgress(docId: number): void {
    const rec = this.snapshot.records[docId];
    if (!rec) return;
    rec.status = 'in-progress';
    rec.lastAttemptAt = new Date().toISOString();
    this.scheduleSave();
  }

  markIndexed(docId: number): void {
    const rec = this.snapshot.records[docId];
    if (!rec) return;
    rec.status = 'indexed';
    rec.lastSuccessAt = new Date().toISOString();
    rec.lastError = null;
    rec.nextRetryAt = null;
    this.scheduleSave();
  }

  markFailed(docId: number, error: string): void {
    const rec = this.snapshot.records[docId];
    if (!rec) return;
    rec.status = 'failed';
    rec.retryCount++;
    rec.lastError = error.slice(0, 200);
    this.scheduleSave();
  }

  markRateLimited(docId: number, nextRetryAt: string, error: string): void {
    const rec = this.snapshot.records[docId];
    if (!rec) return;
    rec.status = 'rate-limited';
    rec.retryCount++;
    rec.lastError = error.slice(0, 200);
    rec.nextRetryAt = nextRetryAt;
    this.scheduleSave();
  }

  setLastBatch(result: string): void {
    this.snapshot.lastBatchAt = new Date().toISOString();
    this.snapshot.lastBatchResult = result.slice(0, 300);
    this.scheduleSave();
  }

  setNextScheduledBatch(time: string | null): void {
    this.snapshot.nextScheduledBatch = time;
    this.scheduleSave();
  }

  /** Return all records matching the given statuses. */
  getRecordsByStatus(...statuses: IndexingStatus[]): DocumentIndexingRecord[] {
    const set = new Set(statuses);
    return Object.values(this.snapshot.records).filter((r) => set.has(r.status));
  }

  /** Return records eligible for retry (rate-limited whose cooldown has expired, or pending). */
  getRetryableRecords(): DocumentIndexingRecord[] {
    const now = Date.now();
    return Object.values(this.snapshot.records).filter((r) => {
      if (r.status === 'pending') return true;
      if (r.status === 'rate-limited') {
        return !r.nextRetryAt || new Date(r.nextRetryAt).getTime() <= now;
      }
      return false;
    });
  }

  getSummary(): IndexingSummary {
    const records = Object.values(this.snapshot.records);
    return {
      pending: records.filter((r) => r.status === 'pending').length,
      inProgress: records.filter((r) => r.status === 'in-progress').length,
      indexed: records.filter((r) => r.status === 'indexed').length,
      failed: records.filter((r) => r.status === 'failed').length,
      rateLimited: records.filter((r) => r.status === 'rate-limited').length,
      total: records.length,
      lastBatchAt: this.snapshot.lastBatchAt,
      lastBatchResult: this.snapshot.lastBatchResult,
      nextScheduledBatch: this.snapshot.nextScheduledBatch,
    };
  }

  /** All records sorted by status priority: in-progress, rate-limited, pending, failed, indexed. */
  getAllRecords(): DocumentIndexingRecord[] {
    const order: Record<IndexingStatus, number> = {
      'in-progress': 0,
      'rate-limited': 1,
      'pending': 2,
      'failed': 3,
      'indexed': 4,
    };
    return Object.values(this.snapshot.records)
      .sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
  }

  isDirty(): boolean {
    return this.dirty;
  }
}
