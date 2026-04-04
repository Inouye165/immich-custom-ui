import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BatchScheduler } from '../vector/BatchScheduler';
import { IndexingStateStore } from '../vector/IndexingStateStore';
import { DocumentIndexer } from '../vector/DocumentIndexer';
import { RateLimitError } from '../vector/EmbeddingRateLimiter';

function createMockIndexer(): DocumentIndexer {
  return {
    scanAndSyncState: vi.fn(),
    indexSingleDocument: vi.fn(),
    runFullIndex: vi.fn(),
  } as unknown as DocumentIndexer;
}

function createMockStateStore(): IndexingStateStore {
  const records = new Map<number, { documentId: number; title: string; status: string }>();
  return {
    getRetryableRecords: vi.fn().mockReturnValue([]),
    markInProgress: vi.fn(),
    markIndexed: vi.fn(),
    markFailed: vi.fn(),
    markRateLimited: vi.fn(),
    setLastBatch: vi.fn(),
    setNextScheduledBatch: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    getAllRecords: vi.fn().mockReturnValue([]),
    getSummary: vi.fn().mockReturnValue({ pending: 0, indexed: 0, total: 0 }),
  } as unknown as IndexingStateStore;
}

describe('BatchScheduler', () => {
  it('returns empty result when no retryable records exist', async () => {
    const indexer = createMockIndexer();
    const store = createMockStateStore();
    const scheduler = new BatchScheduler(indexer, store, { autoEnabled: false });

    const result = await scheduler.runBatch();

    expect(indexer.scanAndSyncState).toHaveBeenCalled();
    expect(result.processed).toBe(0);
    expect(result.indexed).toBe(0);
  });

  it('processes retryable records and marks them indexed', async () => {
    const indexer = createMockIndexer();
    const store = createMockStateStore();
    vi.mocked(store.getRetryableRecords).mockReturnValue([
      { documentId: 1, title: 'Doc 1', fingerprint: 'fp1', status: 'pending', retryCount: 0, lastAttemptAt: null, lastSuccessAt: null, lastError: null, nextRetryAt: null },
      { documentId: 2, title: 'Doc 2', fingerprint: 'fp2', status: 'pending', retryCount: 0, lastAttemptAt: null, lastSuccessAt: null, lastError: null, nextRetryAt: null },
    ]);

    const scheduler = new BatchScheduler(indexer, store, { autoEnabled: false, batchSize: 50 });
    const result = await scheduler.runBatch();

    expect(result.indexed).toBe(2);
    expect(result.processed).toBe(2);
    expect(store.markInProgress).toHaveBeenCalledTimes(2);
    expect(store.markIndexed).toHaveBeenCalledTimes(2);
  });

  it('handles rate limit errors by stopping and marking remaining', async () => {
    const indexer = createMockIndexer();
    vi.mocked(indexer.indexSingleDocument).mockRejectedValueOnce(
      new RateLimitError('429 rate limit', 300_000),
    );

    const store = createMockStateStore();
    vi.mocked(store.getRetryableRecords).mockReturnValue([
      { documentId: 1, title: 'Doc 1', fingerprint: 'fp1', status: 'pending', retryCount: 0, lastAttemptAt: null, lastSuccessAt: null, lastError: null, nextRetryAt: null },
      { documentId: 2, title: 'Doc 2', fingerprint: 'fp2', status: 'pending', retryCount: 0, lastAttemptAt: null, lastSuccessAt: null, lastError: null, nextRetryAt: null },
    ]);

    const scheduler = new BatchScheduler(indexer, store, { autoEnabled: false });
    const result = await scheduler.runBatch();

    expect(result.stoppedByRateLimit).toBe(true);
    expect(result.rateLimited).toBe(2);
    expect(store.markRateLimited).toHaveBeenCalled();
  });

  it('marks failed on non-rate-limit errors', async () => {
    const indexer = createMockIndexer();
    vi.mocked(indexer.indexSingleDocument).mockRejectedValueOnce(
      new Error('Qdrant connection refused'),
    );

    const store = createMockStateStore();
    vi.mocked(store.getRetryableRecords).mockReturnValue([
      { documentId: 1, title: 'Doc 1', fingerprint: 'fp1', status: 'pending', retryCount: 0, lastAttemptAt: null, lastSuccessAt: null, lastError: null, nextRetryAt: null },
    ]);

    const scheduler = new BatchScheduler(indexer, store, { autoEnabled: false });
    const result = await scheduler.runBatch();

    expect(result.failed).toBe(1);
    expect(store.markFailed).toHaveBeenCalledWith(1, 'Qdrant connection refused');
  });

  it('skips overlapping batch runs (single-flight)', async () => {
    const indexer = createMockIndexer();
    // Make scanAndSyncState slow
    vi.mocked(indexer.scanAndSyncState).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    const store = createMockStateStore();
    const scheduler = new BatchScheduler(indexer, store, { autoEnabled: false });

    const [first, second] = await Promise.all([
      scheduler.runBatch(),
      scheduler.runBatch(),
    ]);

    // One should have processed, the other should be a no-op
    expect(
      first.processed + second.processed + first.indexed + second.indexed,
    ).toBeLessThanOrEqual(0); // Both 0 since no retryable records
    // The key test: scanAndSyncState should only be called once
    expect(indexer.scanAndSyncState).toHaveBeenCalledTimes(1);
  });

  it('respects batchSize limit', async () => {
    const indexer = createMockIndexer();
    const store = createMockStateStore();
    const records = Array.from({ length: 10 }, (_, i) => ({
      documentId: i + 1,
      title: `Doc ${i + 1}`,
      fingerprint: `fp${i}`,
      status: 'pending' as const,
      retryCount: 0,
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastError: null,
      nextRetryAt: null,
    }));
    vi.mocked(store.getRetryableRecords).mockReturnValue(records);

    const scheduler = new BatchScheduler(indexer, store, { autoEnabled: false, batchSize: 3 });
    const result = await scheduler.runBatch();

    expect(result.indexed).toBe(3);
    expect(indexer.indexSingleDocument).toHaveBeenCalledTimes(3);
  });

  it('always flushes state store after batch', async () => {
    const indexer = createMockIndexer();
    const store = createMockStateStore();
    const scheduler = new BatchScheduler(indexer, store, { autoEnabled: false });
    await scheduler.runBatch();
    expect(store.flush).toHaveBeenCalled();
  });

  it('start/stop controls the auto loop', () => {
    const indexer = createMockIndexer();
    const store = createMockStateStore();
    const scheduler = new BatchScheduler(indexer, store, { autoEnabled: true, intervalMinutes: 60 });

    expect(scheduler.isAutoEnabled()).toBe(true);
    scheduler.start();
    expect(store.setNextScheduledBatch).toHaveBeenCalled();
    scheduler.stop();
    expect(store.setNextScheduledBatch).toHaveBeenCalledWith(null);
  });
});
