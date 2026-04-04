import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { UpstreamHttpError, type ImmichGateway } from '../immich/ImmichGateway';
import type { PaperlessGateway } from '../paperless/PaperlessGateway';
import type { PaperlessSearchResponse } from '../paperless/paperlessTypes';

const originalImmichBaseUrl = process.env.IMMICH_BASE_URL;
const originalImmichApiKey = process.env.IMMICH_API_KEY;

afterEach(() => {
  if (originalImmichBaseUrl === undefined) {
    delete process.env.IMMICH_BASE_URL;
  } else {
    process.env.IMMICH_BASE_URL = originalImmichBaseUrl;
  }

  if (originalImmichApiKey === undefined) {
    delete process.env.IMMICH_API_KEY;
  } else {
    process.env.IMMICH_API_KEY = originalImmichApiKey;
  }
});

function createGatewayStub(overrides: Partial<ImmichGateway>): ImmichGateway {
  return {
    getAssetInfo: vi.fn(),
    getAssetMetadata: vi.fn(),
    searchSmart: vi.fn(),
    fetchThumbnail: vi.fn(),
    fetchVideoPlayback: vi.fn(),
    trashAssets: vi.fn(),
    ...overrides,
  };
}

describe('server app', () => {
  it('returns a configuration error when no api key is configured', async () => {
    process.env.IMMICH_BASE_URL = 'http://localhost:2283';
    delete process.env.IMMICH_API_KEY;

    const app = createApp();
    const response = await request(app).post('/api/search').send({ query: 'sunset' });

    expect(response.status).toBe(500);
    expect(response.body.message).toBe(
      'Server search is not configured. Set IMMICH_BASE_URL and IMMICH_API_KEY.',
    );
  });

  it('rejects invalid date ranges', async () => {
    const app = createApp({
      immichGateway: createGatewayStub({
        getAssetInfo: vi.fn(),
        getAssetMetadata: vi.fn(),
        searchSmart: vi.fn(),
        fetchThumbnail: vi.fn(),
      }),
    });

    const response = await request(app).post('/api/search').send({
      query: 'trip',
      startDate: '2024-12-10',
      endDate: '2024-01-01',
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Start date must be before end date.');
  });

  it('returns a normalized search response', async () => {
    const gateway = createGatewayStub({
      searchSmart: vi.fn().mockResolvedValue({
        albums: null,
        assets: {
          count: 1,
          nextPage: null,
          total: 1,
          items: [
            {
              id: '0d2cbf93-6075-4f8d-bdc3-6f3777eb34ab',
              createdAt: '2024-08-15T12:00:00.000Z',
              fileCreatedAt: '2024-08-15T12:00:00.000Z',
              localDateTime: '2024-08-15T05:00:00.000Z',
              originalFileName: 'sunset.jpg',
              type: 'IMAGE',
              exifInfo: { city: 'Seattle', state: 'Washington', country: 'USA' },
            },
          ],
        },
      }),
      getAssetInfo: vi.fn(),
      getAssetMetadata: vi.fn(),
      fetchThumbnail: vi.fn(),
    });

    const app = createApp({ immichGateway: gateway });
    const response = await request(app).post('/api/search').send({ query: 'sunset' });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(gateway.searchSmart).toHaveBeenCalledWith({
      query: 'sunset',
      page: 1,
      size: 60,
    });
  });

  it('returns a friendly upstream auth error', async () => {
    const app = createApp({
      immichGateway: createGatewayStub({
        getAssetInfo: vi.fn(),
        getAssetMetadata: vi.fn(),
        searchSmart: vi.fn().mockRejectedValue(new UpstreamHttpError(401, 'The photo library rejected the configured API key.')),
        fetchThumbnail: vi.fn(),
      }),
    });

    const response = await request(app).post('/api/search').send({ query: 'sunset' });

    expect(response.status).toBe(502);
    expect(response.body.message).toBe('Photo library credentials were rejected. Check IMMICH_API_KEY.');
  });
});

function createPaperlessStub(overrides: Partial<PaperlessGateway> = {}): PaperlessGateway {
  return {
    searchDocuments: vi.fn(),
    listDocuments: vi.fn(),
    fetchThumbnail: vi.fn(),
    fetchPreview: vi.fn(),
    deleteDocument: vi.fn(),
    ...overrides,
  };
}

describe('document search routes', () => {
  it('rejects empty query', async () => {
    const app = createApp({
      immichGateway: createGatewayStub({}),
      paperlessGateway: createPaperlessStub(),
    });

    const response = await request(app).get('/api/documents/search').query({ query: '' });
    expect(response.status).toBe(400);
  });

  it('returns normalized document search results', async () => {
    const paperlessResponse: PaperlessSearchResponse = {
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 42,
          title: 'Tax Return',
          created: '2024-04-15T00:00:00Z',
          added: '2024-04-20T00:00:00Z',
          correspondent: 1,
          document_type: 2,
          archive_serial_number: null,
          content: 'Federal income tax return for the year 2024',
        },
      ],
    };

    const paperless = createPaperlessStub({
      searchDocuments: vi.fn().mockResolvedValue(paperlessResponse),
    });

    const app = createApp({
      immichGateway: createGatewayStub({}),
      paperlessGateway: paperless,
    });

    const response = await request(app)
      .get('/api/documents/search')
      .query({ query: 'tax', mode: 'keyword' });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.hasMore).toBe(false);
    expect(response.body.results).toHaveLength(1);
    expect(response.body.results[0]).toMatchObject({
      id: 42,
      title: 'Tax Return',
      thumbnailUrl: '/api/documents/42/thumb',
      previewUrl: '/api/documents/42/preview',
    });
    expect(paperless.searchDocuments).toHaveBeenCalledWith('tax', 1);
  });

  it('passes page parameter through', async () => {
    const paperless = createPaperlessStub({
      searchDocuments: vi.fn().mockResolvedValue({
        count: 0,
        next: null,
        previous: null,
        results: [],
      }),
    });

    const app = createApp({
      immichGateway: createGatewayStub({}),
      paperlessGateway: paperless,
    });

    await request(app)
      .get('/api/documents/search')
      .query({ query: 'invoice', page: '3' });

    expect(paperless.searchDocuments).toHaveBeenCalledWith('invoice', 3);
  });
});

describe('document delete route', () => {
  it('deletes a document and returns the deleted id', async () => {
    const paperless = createPaperlessStub({
      deleteDocument: vi.fn().mockResolvedValue(undefined),
    });

    const app = createApp({
      immichGateway: createGatewayStub({}),
      paperlessGateway: paperless,
    });

    const response = await request(app).delete('/api/documents/42');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ deletedId: 42 });
    expect(paperless.deleteDocument).toHaveBeenCalledWith(42);
  });

  it('rejects non-integer document id', async () => {
    const app = createApp({
      immichGateway: createGatewayStub({}),
      paperlessGateway: createPaperlessStub(),
    });

    const response = await request(app).delete('/api/documents/abc');
    expect(response.status).toBe(400);
  });
});
