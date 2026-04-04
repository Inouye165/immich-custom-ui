import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiIndexingStatusService } from '../services/ApiIndexingStatusService';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ApiIndexingStatusService', () => {
  it('fetches indexing summary', async () => {
    const mockSummary = {
      pending: 3,
      inProgress: 0,
      indexed: 42,
      failed: 1,
      rateLimited: 0,
      total: 46,
      lastBatchAt: '2025-01-01T00:00:00.000Z',
      lastBatchResult: 'ok',
      nextScheduledBatch: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockSummary), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const service = new ApiIndexingStatusService();
    const result = await service.getSummary();
    expect(result.indexed).toBe(42);
    expect(result.total).toBe(46);
  });

  it('fetches records with pagination', async () => {
    const mockRecords = {
      records: [
        { documentId: 1, title: 'Doc 1', status: 'indexed' },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockRecords), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const service = new ApiIndexingStatusService();
    const result = await service.getRecords(50, 0);
    expect(result.records).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(fetchMock).toHaveBeenCalledOnce();
    // Verify URL construction
    const url = fetchMock.mock.calls[0][0] as URL;
    expect(url.searchParams.get('limit')).toBe('50');
    expect(url.searchParams.get('offset')).toBe('0');
  });

  it('triggers a batch run', async () => {
    const mockResult = {
      processed: 3,
      indexed: 2,
      skipped: 0,
      failed: 1,
      rateLimited: 0,
      durationMs: 1234,
      stoppedByRateLimit: false,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockResult), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const service = new ApiIndexingStatusService();
    const result = await service.triggerBatch();
    expect(result.indexed).toBe(2);
    expect(result.failed).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/indexing/batch', { method: 'POST' });
  });

  it('throws on summary error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Not configured.' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const service = new ApiIndexingStatusService();
    await expect(service.getSummary()).rejects.toThrow('Not configured.');
  });

  it('throws on batch trigger error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Vector not enabled.' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const service = new ApiIndexingStatusService();
    await expect(service.triggerBatch()).rejects.toThrow('Vector not enabled.');
  });
});
