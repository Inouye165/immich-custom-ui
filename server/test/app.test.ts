import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { UpstreamHttpError, type ImmichGateway } from '../immich/ImmichGateway';

function createGatewayStub(overrides: Partial<ImmichGateway>): ImmichGateway {
  return {
    searchSmart: vi.fn(),
    fetchThumbnail: vi.fn(),
    ...overrides,
  };
}

describe('server app', () => {
  it('rejects invalid date ranges', async () => {
    const app = createApp({
      immichGateway: createGatewayStub({
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
        searchSmart: vi.fn().mockRejectedValue(new UpstreamHttpError(401, 'Immich rejected the configured API key.')),
        fetchThumbnail: vi.fn(),
      }),
    });

    const response = await request(app).post('/api/search').send({ query: 'sunset' });

    expect(response.status).toBe(502);
    expect(response.body.message).toBe('Immich credentials were rejected. Check IMMICH_API_KEY.');
  });
});
