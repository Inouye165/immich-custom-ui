import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { IndexingStateStore } from '../vector/IndexingStateStore';
import { BatchScheduler } from '../vector/BatchScheduler';

function createMockStateStore() {
  return {
    getSummary: vi.fn().mockReturnValue({
      pending: 3,
      inProgress: 1,
      indexed: 42,
      failed: 2,
      rateLimited: 0,
      total: 48,
      lastBatchAt: '2025-01-01T00:00:00.000Z',
      lastBatchResult: 'Batch complete. Indexed: 5',
      nextScheduledBatch: '2025-01-01T00:15:00.000Z',
    }),
    getAllRecords: vi.fn().mockReturnValue([
      {
        documentId: 1,
        title: 'Test Doc',
        fingerprint: 'fp1',
        status: 'indexed',
        retryCount: 0,
        lastAttemptAt: null,
        lastSuccessAt: '2025-01-01T00:00:00.000Z',
        lastError: null,
        nextRetryAt: null,
      },
    ]),
    load: vi.fn().mockResolvedValue(undefined),
    flush: vi.fn().mockResolvedValue(undefined),
  } as unknown as IndexingStateStore;
}

function createMockScheduler() {
  return {
    runBatch: vi.fn().mockResolvedValue({
      processed: 3,
      indexed: 2,
      skipped: 0,
      failed: 1,
      rateLimited: 0,
      durationMs: 1234,
      stoppedByRateLimit: false,
    }),
    start: vi.fn(),
    stop: vi.fn(),
    isRunning: vi.fn().mockReturnValue(false),
    isAutoEnabled: vi.fn().mockReturnValue(false),
  } as unknown as BatchScheduler;
}

describe('indexing API', () => {
  it('GET /api/indexing/summary returns indexing summary', async () => {
    const store = createMockStateStore();
    const app = createApp({ indexingStateStore: store });

    const response = await request(app).get('/api/indexing/summary');
    expect(response.status).toBe(200);
    expect(response.body.total).toBe(48);
    expect(response.body.indexed).toBe(42);
    expect(response.body.pending).toBe(3);
  });

  it('GET /api/indexing/records returns paginated records', async () => {
    const store = createMockStateStore();
    const app = createApp({ indexingStateStore: store });

    const response = await request(app).get('/api/indexing/records?limit=10&offset=0');
    expect(response.status).toBe(200);
    expect(response.body.records).toHaveLength(1);
    expect(response.body.total).toBe(1);
    expect(response.body.limit).toBe(10);
    expect(response.body.offset).toBe(0);
  });

  it('GET /api/indexing/records clamps limit to 500', async () => {
    const store = createMockStateStore();
    const app = createApp({ indexingStateStore: store });

    const response = await request(app).get('/api/indexing/records?limit=9999');
    expect(response.status).toBe(200);
    expect(response.body.limit).toBe(500);
  });

  it('POST /api/indexing/batch triggers a batch run', async () => {
    const store = createMockStateStore();
    const scheduler = createMockScheduler();
    const app = createApp({ indexingStateStore: store, batchScheduler: scheduler });

    const response = await request(app).post('/api/indexing/batch');
    expect(response.status).toBe(200);
    expect(response.body.indexed).toBe(2);
    expect(response.body.failed).toBe(1);
    expect(scheduler.runBatch).toHaveBeenCalled();
  });
});
