import { afterEach, describe, expect, it } from 'vitest';
import { ConfigurationError, getPort, getServerConfig } from '../config';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('server config', () => {
  it('applies defaults for optional asset-context settings', () => {
    process.env.IMMICH_BASE_URL = 'http://localhost:2283';
    process.env.IMMICH_API_KEY = 'secret';
    delete process.env.GEMINI_API_KEY;
    delete process.env.WEATHER_BASE_URL;
    delete process.env.OVERPASS_BASE_URL;
    delete process.env.MAP_DEFAULT_ZOOM;
    delete process.env.MAP_POI_RADIUS_METERS;

    const config = getServerConfig();

    expect(config.port).toBe(3001);
    expect(config.weatherProvider).toBe('open-meteo');
    expect(config.weatherBaseUrl).toBe('https://archive-api.open-meteo.com/v1/archive');
    expect(config.overpassBaseUrl).toBe('https://overpass-api.de/api/interpreter');
    expect(config.mapDefaultZoom).toBe(15);
    expect(config.mapPoiRadiusMeters).toBe(1000);
    expect(config.geminiApiKey).toBeUndefined();
  });

  it('returns a clear error when required Immich settings are missing', () => {
    delete process.env.IMMICH_BASE_URL;
    delete process.env.IMMICH_API_KEY;

    expect(() => getServerConfig()).toThrowError(
      new ConfigurationError(
        'Server search is not configured. Missing env: IMMICH_BASE_URL, IMMICH_API_KEY.',
      ),
    );
  });

  it('throws a configuration error for invalid numeric overrides', () => {
    process.env.IMMICH_BASE_URL = 'http://localhost:2283';
    process.env.IMMICH_API_KEY = 'secret';
    process.env.MAP_DEFAULT_ZOOM = '30';

    expect(() => getServerConfig()).toThrowError(
      'Server configuration is invalid for MAP_DEFAULT_ZOOM.',
    );
  });

  it('parses the configured server port', () => {
    process.env.PORT = '4123';

    expect(getPort()).toBe(4123);
  });
});