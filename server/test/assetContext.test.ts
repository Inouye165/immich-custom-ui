import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import type { ServerConfig } from '../config';
import type { ImmichGateway } from '../immich/ImmichGateway';
import type { AiSummaryService } from '../services/GeminiService';
import type { PoiService } from '../services/PoiService';
import type { WeatherService } from '../services/WeatherService';

const SAMPLE_ASSET = {
  id: 'asset-1',
  createdAt: '2024-08-15T12:00:00.000Z',
  fileCreatedAt: '2024-08-15T12:00:00.000Z',
  fileModifiedAt: '2024-08-15T12:30:00.000Z',
  localDateTime: '2024-08-15T05:15:00.000Z',
  originalFileName: 'sunset.jpg',
  originalMimeType: 'image/jpeg',
  type: 'IMAGE',
  width: 4032,
  height: 3024,
  exifInfo: {
    dateTimeOriginal: '2024-08-15T19:15:00-07:00',
    latitude: 47.6062,
    longitude: -122.3321,
    city: 'Seattle',
    state: 'Washington',
    country: 'USA',
    make: 'Sony',
    model: 'A7C',
    exifImageWidth: 4032,
    exifImageHeight: 3024,
  },
};

const SAMPLE_CONFIG: ServerConfig = {
  immichApiKey: 'secret',
  immichBaseUrl: 'http://localhost:2283',
  port: 3001,
  geminiApiKey: undefined,
  weatherProvider: 'open-meteo',
  weatherBaseUrl: 'https://archive-api.open-meteo.com/v1/archive',
  overpassBaseUrl: 'https://overpass-api.de/api/interpreter',
  mapDefaultZoom: 15,
  mapPoiRadiusMeters: 1000,
};

function createGatewayStub(overrides: Partial<ImmichGateway>): ImmichGateway {
  return {
    getAssetInfo: vi.fn().mockResolvedValue(SAMPLE_ASSET),
    getAssetMetadata: vi.fn().mockResolvedValue({ importSource: 'sidecar' }),
    searchSmart: vi.fn(),
    fetchThumbnail: vi.fn(),
    ...overrides,
  };
}

function createPoiService(overrides: Partial<PoiService> = {}): PoiService {
  return {
    getNearbyPois: vi.fn().mockResolvedValue({
      source: 'live',
      value: [
        {
          id: 'node-1',
          name: 'Pike Place Market',
          category: 'Tourism',
          latitude: 47.6097,
          longitude: -122.3425,
          distanceMeters: 821,
        },
      ],
    }),
    ...overrides,
  };
}

function createWeatherService(overrides: Partial<WeatherService> = {}): WeatherService {
  return {
    getHistoricalWeather: vi.fn().mockResolvedValue({
      source: 'live',
      value: {
        temperatureC: 20,
        temperatureF: 68,
        apparentTemperatureC: 21,
        apparentTemperatureF: 69.8,
        weatherCode: 1,
        weatherLabel: 'Mostly clear',
        observedAt: '2024-08-15T19:00:00',
        isApproximate: false,
        source: 'open-meteo',
        summary: null,
      },
    }),
    ...overrides,
  };
}

function createAiSummaryService(overrides: Partial<AiSummaryService> = {}): AiSummaryService {
  return {
    isEnabled: vi.fn().mockReturnValue(true),
    summarizePhotoContext: vi.fn().mockResolvedValue({
      source: 'live',
      value: 'Taken in Seattle near Pike Place Market on a mostly clear evening.',
    }),
    ...overrides,
  };
}

describe('asset context route', () => {
  it('returns a combined asset context payload on the happy path', async () => {
    const app = createApp({
      immichGateway: createGatewayStub({}),
      poiService: createPoiService(),
      weatherService: createWeatherService(),
      aiSummaryService: createAiSummaryService(),
      serverConfig: SAMPLE_CONFIG,
    });

    const response = await request(app).get('/api/assets/asset-1/context?includeAiSummary=true');

    expect(response.status).toBe(200);
    expect(response.body.asset.title).toBe('sunset.jpg');
    expect(response.body.gps).toEqual({ latitude: 47.6062, longitude: -122.3321 });
    expect(response.body.map).toEqual({
      zoom: 15,
      center: { latitude: 47.6062, longitude: -122.3321 },
    });
    expect(response.body.pois).toHaveLength(1);
    expect(response.body.weather.weatherLabel).toBe('Mostly clear');
    expect(response.body.aiSummary).toContain('Seattle');
    expect(response.body.status).toEqual({
      aiSummary: 'live',
      pois: 'live',
      weather: 'live',
    });
    expect(response.body.warnings).toEqual([]);
  });

  it('returns metadata and a graceful no-gps state when coordinates are missing', async () => {
    const app = createApp({
      immichGateway: createGatewayStub({
        getAssetInfo: vi.fn().mockResolvedValue({
          ...SAMPLE_ASSET,
          exifInfo: {
            ...SAMPLE_ASSET.exifInfo,
            latitude: null,
            longitude: null,
          },
        }),
      }),
      poiService: createPoiService(),
      weatherService: createWeatherService(),
      aiSummaryService: createAiSummaryService(),
      serverConfig: SAMPLE_CONFIG,
    });

    const response = await request(app).get('/api/assets/asset-1/context');

    expect(response.status).toBe(200);
    expect(response.body.metadata.cameraModel).toBe('A7C');
    expect(response.body.gps).toBeNull();
    expect(response.body.map).toBeNull();
    expect(response.body.pois).toEqual([]);
    expect(response.body.weather).toBeNull();
    expect(response.body.status).toEqual({
      aiSummary: 'unavailable',
      pois: 'unavailable',
      weather: 'unavailable',
    });
  });

  it('keeps the rest of the asset context when weather lookup fails', async () => {
    const app = createApp({
      immichGateway: createGatewayStub({}),
      poiService: createPoiService(),
      weatherService: createWeatherService({
        getHistoricalWeather: vi.fn().mockRejectedValue(new Error('timeout')),
      }),
      aiSummaryService: createAiSummaryService({
        summarizePhotoContext: vi.fn().mockResolvedValue({
          source: 'live',
          value: null,
        }),
      }),
      serverConfig: SAMPLE_CONFIG,
    });

    const response = await request(app).get('/api/assets/asset-1/context');

    expect(response.status).toBe(200);
    expect(response.body.gps).toEqual({ latitude: 47.6062, longitude: -122.3321 });
    expect(response.body.weather).toBeNull();
    expect(response.body.pois).toHaveLength(1);
    expect(response.body.status.weather).toBe('fallback');
    expect(response.body.warnings).toContain('Historical weather is unavailable right now.');
  });

  it('silently degrades when Gemini is not configured', async () => {
    const app = createApp({
      immichGateway: createGatewayStub({}),
      poiService: createPoiService(),
      weatherService: createWeatherService(),
      aiSummaryService: createAiSummaryService({
        isEnabled: vi.fn().mockReturnValue(false),
        summarizePhotoContext: vi.fn().mockResolvedValue({
          source: 'live',
          value: null,
        }),
      }),
      serverConfig: SAMPLE_CONFIG,
    });

    const response = await request(app).get('/api/assets/asset-1/context?includeAiSummary=true');

    expect(response.status).toBe(200);
    expect(response.body.aiSummary).toBeNull();
    expect(response.body.aiSummaryAvailable).toBe(false);
    expect(response.body.status.aiSummary).toBe('disabled');
    expect(response.body.warnings).toEqual([]);
  });
});