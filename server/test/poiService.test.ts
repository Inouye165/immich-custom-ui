import { rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LivePoiService } from '../services/PoiService';

const poiCacheDir = path.join(process.cwd(), '.runtime', 'api-cache', 'nearby-pois');

beforeEach(async () => {
  await rm(poiCacheDir, { force: true, recursive: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LivePoiService', () => {
  it('falls back to the next Overpass endpoint when the first one times out', async () => {
    const latitude = 11.12345;
    const longitude = -22.54321;
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('dispatcher timeout'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            elements: [
              {
                id: 1,
                lat: 44.5512,
                lon: -110.808,
                tags: {
                  name: 'Grand Prismatic Spring',
                  natural: 'spring',
                },
                type: 'node',
              },
            ],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      );

    vi.stubGlobal('fetch', fetchMock);

    const service = new LivePoiService({
      mapPoiRadiusMeters: 1000,
      overpassBaseUrl: 'https://overpass-api.de/api/interpreter',
    });

    const result = await service.getNearbyPois({
      latitude,
      longitude,
    });

    expect(result.source).toBe('live');
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.name).toBe('Grand Prismatic Spring');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});