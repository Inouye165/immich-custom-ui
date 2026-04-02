import 'dotenv/config';
import { ZodError, z } from 'zod';

const blankToUndefined = (value: unknown) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const envSchema = z.object({
  IMMICH_BASE_URL: z.string().url().optional(),
  IMMICH_API_KEY: z.string().min(1).optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  GEMINI_API_KEY: z.preprocess(blankToUndefined, z.string().min(1).optional()),
  WEATHER_PROVIDER: z.enum(['open-meteo']).default('open-meteo'),
  WEATHER_BASE_URL: z.preprocess(blankToUndefined, z.string().url().optional()),
  OVERPASS_BASE_URL: z.preprocess(blankToUndefined, z.string().url().optional()),
  MAP_DEFAULT_ZOOM: z.coerce.number().int().min(1).max(20).default(15),
  MAP_POI_RADIUS_METERS: z.coerce.number().int().min(100).max(10000).default(1000),
});

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export interface ServerConfig {
  immichBaseUrl: string;
  immichApiKey: string;
  port: number;
  geminiApiKey?: string;
  weatherProvider: 'open-meteo';
  weatherBaseUrl: string;
  overpassBaseUrl: string;
  mapDefaultZoom: number;
  mapPoiRadiusMeters: number;
}

export function getPort(): number {
  return parseEnvironment().PORT;
}

export function getServerConfig(): ServerConfig {
  const parsed = parseEnvironment();

  if (!parsed.IMMICH_BASE_URL || !parsed.IMMICH_API_KEY) {
    throw new ConfigurationError(
      'Server is not configured for Immich search. Set IMMICH_BASE_URL and IMMICH_API_KEY.',
    );
  }

  return {
    immichBaseUrl: parsed.IMMICH_BASE_URL.replace(/\/$/, ''),
    immichApiKey: parsed.IMMICH_API_KEY,
    port: parsed.PORT,
    geminiApiKey: parsed.GEMINI_API_KEY,
    weatherProvider: parsed.WEATHER_PROVIDER,
    weatherBaseUrl:
      parsed.WEATHER_BASE_URL ?? 'https://archive-api.open-meteo.com/v1/archive',
    overpassBaseUrl:
      parsed.OVERPASS_BASE_URL ?? 'https://overpass-api.de/api/interpreter',
    mapDefaultZoom: parsed.MAP_DEFAULT_ZOOM,
    mapPoiRadiusMeters: parsed.MAP_POI_RADIUS_METERS,
  };
}

function parseEnvironment() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      const key = issue?.path[0] ?? 'environment';
      throw new ConfigurationError(
        `Server configuration is invalid for ${String(key)}. ${issue?.message ?? 'Review your .env values.'}`,
      );
    }

    throw error;
  }
}
