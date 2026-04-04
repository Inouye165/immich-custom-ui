import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DocumentIndexingRecord, IndexingSummary } from '../vector/IndexingStateStore';
import { BatchScheduler } from '../vector/BatchScheduler';
import { IndexingStateStore } from '../vector/IndexingStateStore';
import { DocumentIndexer } from '../vector/DocumentIndexer';
import { RateLimitError } from '../vector/EmbeddingRateLimiter';

function createRecord(overrides: Partial<DocumentIndexingRecord> = {}): DocumentIndexingRecord {
  return {
    documentId: 1,
    title: 'Doc 1',
    fingerprint: 'fp1',
    status: 'pending',
    totalChunks: null,
    completedChunks: null,
    retryCount: 0,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastError: null,
    nextRetryAt: null,
    ...overrides,
  };
}

function createSummary(overrides: Partial<IndexingSummary> = {}): IndexingSummary {
  return {
    pending: 0,
    inProgress: 0,
    indexed: 0,
    failed: 0,
    rateLimited: 0,
    total: 0,
    lastBatchAt: null,
    lastBatchResult: null,
    nextScheduledBatch: null,
    ...overrides,
  };
}

function createMockIndexer(): DocumentIndexer {
  return {
    scanAndSyncState: vi.fn(),
    indexSingleDocument: vi.fn(),
    runFullIndex: vi.fn(),
  } as unknown as DocumentIndexer;
}

function createMockStateStore(): IndexingStateStore {
  return {
    getRetryableRecords: vi.fn().mockReturnValue([]),
    getEarliestRetryAt: vi.fn().mockReturnValue(null),
    markInProgress: vi.fn(),
    markIndexed: vi.fn(),
    markFailed: vi.fn(),
    markRateLimited: vi.fn(),
    setLastBatch: vi.fn(),
    setNextScheduledBatch: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    getAllRecords: vi.fn().mockReturnValue([]),
    getSummary: vi.fn().mockReturnValue(createSummary()),
  } as unknown as IndexingStateStore;
}

afterEach(() => {
  vi.useRealTimers();
});

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
      createRecord(),
      createRecord({ documentId: 2, title: 'Doc 2', fingerprint: 'fp2' }),
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
      createRecord(),
      createRecord({ documentId: 2, title: 'Doc 2', fingerprint: 'fp2' }),
    ]);

    const scheduler = new BatchScheduler(indexer, store, { autoEnabled: false });
    const result = await scheduler.runBatch();

    expect(result.stoppedByRateLimit).toBe(true);
    expect(result.rateLimited).toBe(1);
    expect(store.markRateLimited).toHaveBeenCalledTimes(1);
  });

  it('schedules an automatic retry after a rate limit cooldown', async () => {
    vi.useFakeTimers();
    const indexer = createMockIndexer();
    vi.mocked(indexer.indexSingleDocument)
      .mockRejectedValueOnce(new RateLimitError('429 rate limit', 5_000))
      .mockResolvedValueOnce(undefined);

    const store = createMockStateStore();
    vi.mocked(store.getRetryableRecords)
      .mockReturnValueOnce([
        createRecord(),
      ])
      .mockReturnValueOnce([
        createRecord({
          status: 'rate-limited',
          retryCount: 1,
          lastError: '429 rate limit',
          nextRetryAt: new Date(Date.now() + 5_000).toISOString(),
        }),
      ]);

    const scheduler = new BatchScheduler(indexer, store, { autoEnabled: false });
    await scheduler.runBatch();

    expect(store.setNextScheduledBatch).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5_000);

    expect(indexer.scanAndSyncState).toHaveBeenCalledTimes(2);
    expect(vi.mocked(indexer.indexSingleDocument)).toHaveBeenCalledTimes(2);
    expect(store.markIndexed).toHaveBeenCalledWith(1);
  });

  it('marks failed on non-rate-limit errors', async () => {
    const indexer = createMockIndexer();
    vi.mocked(indexer.indexSingleDocument).mockRejectedValueOnce(
      new Error('Qdrant connection refused'),
    );

    const store = createMockStateStore();
    vi.mocked(store.getRetryableRecords).mockReturnValue([
      createRecord(),
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
      ...createRecord({
        documentId: i + 1,
        title: `Doc ${i + 1}`,
        fingerprint: `fp${i}`,
      }),
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

  it('rehydrates a persisted scheduled retry', async () => {
    vi.useFakeTimers();
    const indexer = createMockIndexer();
    const store = createMockStateStore();
    vi.mocked(store.getSummary).mockReturnValue(createSummary({
      pending: 1,
      rateLimited: 1,
      total: 1,
      nextScheduledBatch: new Date(Date.now() + 5_000).toISOString(),
    }));
    vi.mocked(store.getRetryableRecords).mockReturnValue([
      createRecord({
        status: 'rate-limited',
        retryCount: 1,
        lastError: '429 rate limit',
        nextRetryAt: new Date(Date.now() - 1_000).toISOString(),
      }),
    ]);

    const scheduler = new BatchScheduler(indexer, store, { autoEnabled: false });
    scheduler.resumePendingRetry();

    await vi.advanceTimersByTimeAsync(5_000);

    expect(indexer.scanAndSyncState).toHaveBeenCalledTimes(1);
    expect(indexer.indexSingleDocument).toHaveBeenCalledTimes(1);
  });

  it('continues manual batch processing when more retryable work remains', async () => {
    vi.useFakeTimers();
    const indexer = createMockIndexer();
    const store = createMockStateStore();
    vi.mocked(store.getRetryableRecords)
      .mockReturnValueOnce([
        createRecord(),
      ])
      .mockReturnValueOnce([
        createRecord({ documentId: 2, title: 'Doc 2', fingerprint: 'fp2' }),
      ])
      .mockReturnValueOnce([
        createRecord({ documentId: 2, title: 'Doc 2', fingerprint: 'fp2' }),
      ])
      .mockReturnValueOnce([]);

    const scheduler = new BatchScheduler(indexer, store, { autoEnabled: false });
    await scheduler.runBatch();

    await vi.advanceTimersByTimeAsync(1_000);

    expect(indexer.scanAndSyncState).toHaveBeenCalledTimes(2);
    expect(vi.mocked(indexer.indexSingleDocument)).toHaveBeenCalledTimes(2);
  });
});
