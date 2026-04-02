import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiAssetContextService } from '../services/ApiAssetContextService';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ApiAssetContextService', () => {
  it('caches repeated asset context requests in memory', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          asset: { id: '1', title: 'one.jpg' },
          metadata: {},
          gps: null,
          map: null,
          pois: [],
          weather: null,
          aiSummary: null,
          aiSummaryAvailable: false,
          status: {
            aiSummary: 'disabled',
            pois: 'unavailable',
            weather: 'unavailable',
          },
          warnings: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    vi.stubGlobal('fetch', fetchMock);

    const service = new ApiAssetContextService();
    await service.getAssetContext('1');
    await service.getAssetContext('1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});