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
  PAPERLESS_BASE_URL: z.preprocess(blankToUndefined, z.string().url().optional()),
  PAPERLESS_API_TOKEN: z.preprocess(blankToUndefined, z.string().min(1).optional()),
  QDRANT_URL: z.preprocess(blankToUndefined, z.string().url().optional()),
  QDRANT_API_KEY: z.preprocess(blankToUndefined, z.string().min(1).optional()),
  DOCUMENT_VECTOR_ENABLED: z.preprocess(blankToUndefined, z.string().optional()),
  DOCUMENT_VECTOR_COLLECTION: z.preprocess(blankToUndefined, z.string().min(1).optional()),
  DOCUMENT_EMBEDDING_PROVIDER: z.preprocess(blankToUndefined, z.string().min(1).optional()),
  DOCUMENT_EMBEDDING_MODEL: z.preprocess(blankToUndefined, z.string().min(1).optional()),
  DOCUMENT_EMBEDDING_API_KEY: z.preprocess(blankToUndefined, z.string().min(1).optional()),
  DOCUMENT_EMBEDDING_BASE_URL: z.preprocess(blankToUndefined, z.string().url().optional()),
  DOCUMENT_INDEX_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(50),
  DOCUMENT_SCHEDULER_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(5),
  DOCUMENT_INDEX_CHUNK_SIZE: z.coerce.number().int().min(100).max(10000).default(1000),
  DOCUMENT_INDEX_CHUNK_OVERLAP: z.coerce.number().int().min(0).max(2000).default(200),
  VECTOR_SCHEMA_VERSION: z.preprocess(blankToUndefined, z.string().min(1).optional()),
  DOCUMENT_INDEX_AUTO_ENABLED: z.preprocess(blankToUndefined, z.string().optional()),
  DOCUMENT_INDEX_AUTO_INTERVAL_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  DOCUMENT_EMBED_REQUESTS_PER_MINUTE: z.coerce.number().int().min(1).max(600).default(10),
  DOCUMENT_EMBED_COOLDOWN_MINUTES: z.coerce.number().int().min(1).max(60).default(5),
  DOCUMENT_EMBED_MAX_RETRIES: z.coerce.number().int().min(1).max(20).default(5),
  DOCUMENT_EMBED_BACKOFF_BASE_MS: z.coerce.number().int().min(100).max(60000).default(2000),
  DOCUMENT_EMBED_BACKOFF_MAX_MS: z.coerce.number().int().min(1000).max(600000).default(120000),
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
  paperlessBaseUrl?: string;
  paperlessApiToken?: string;
}

export interface PaperlessConfig {
  baseUrl: string;
  apiToken: string;
}

export interface VectorConfig {
  qdrantUrl: string;
  qdrantApiKey?: string;
  collection: string;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingApiKey?: string;
  embeddingBaseUrl?: string;
  indexBatchSize: number;
  schedulerBatchSize: number;
  indexChunkSize: number;
  indexChunkOverlap: number;
  schemaVersion: string;
  autoIndexEnabled: boolean;
  autoIndexIntervalMinutes: number;
  embedRequestsPerMinute: number;
  embedCooldownMinutes: number;
  embedMaxRetries: number;
  embedBackoffBaseMs: number;
  embedBackoffMaxMs: number;
}

export function getPort(): number {
  return parseEnvironment().PORT;
}

export function getServerConfig(): ServerConfig {
  const parsed = parseEnvironment();

  if (!parsed.IMMICH_BASE_URL || !parsed.IMMICH_API_KEY) {
    throw new ConfigurationError(
      'Server search is not configured. Set IMMICH_BASE_URL and IMMICH_API_KEY.',
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
    paperlessBaseUrl: parsed.PAPERLESS_BASE_URL?.replace(/\/$/, ''),
    paperlessApiToken: parsed.PAPERLESS_API_TOKEN,
  };
}

/** Returns Paperless config independently of Immich. Null when not configured. */
export function getPaperlessConfig(): PaperlessConfig | null {
  const parsed = parseEnvironment();
  if (!parsed.PAPERLESS_BASE_URL || !parsed.PAPERLESS_API_TOKEN) {
    return null;
  }
  return {
    baseUrl: parsed.PAPERLESS_BASE_URL.replace(/\/$/, ''),
    apiToken: parsed.PAPERLESS_API_TOKEN,
  };
}

/** Returns vector-search config independently. Null when disabled or incomplete. */
export function getVectorConfig(): VectorConfig | null {
  const parsed = parseEnvironment();
  if (parsed.DOCUMENT_VECTOR_ENABLED?.toLowerCase() !== 'true') {
    return null;
  }
  if (
    !parsed.QDRANT_URL ||
    !parsed.DOCUMENT_EMBEDDING_PROVIDER ||
    !parsed.DOCUMENT_EMBEDDING_MODEL
  ) {
    return null;
  }
  return {
    qdrantUrl: parsed.QDRANT_URL.replace(/\/$/, ''),
    qdrantApiKey: parsed.QDRANT_API_KEY,
    collection: parsed.DOCUMENT_VECTOR_COLLECTION ?? 'documents',
    embeddingProvider: parsed.DOCUMENT_EMBEDDING_PROVIDER,
    embeddingModel: parsed.DOCUMENT_EMBEDDING_MODEL,
    embeddingApiKey: parsed.DOCUMENT_EMBEDDING_API_KEY,
    embeddingBaseUrl: parsed.DOCUMENT_EMBEDDING_BASE_URL?.replace(/\/$/, ''),
    indexBatchSize: parsed.DOCUMENT_INDEX_BATCH_SIZE,
    schedulerBatchSize: parsed.DOCUMENT_SCHEDULER_BATCH_SIZE,
    indexChunkSize: parsed.DOCUMENT_INDEX_CHUNK_SIZE,
    indexChunkOverlap: parsed.DOCUMENT_INDEX_CHUNK_OVERLAP,
    schemaVersion: parsed.VECTOR_SCHEMA_VERSION ?? 'v1',
    autoIndexEnabled: parsed.DOCUMENT_INDEX_AUTO_ENABLED?.toLowerCase() === 'true',
    autoIndexIntervalMinutes: parsed.DOCUMENT_INDEX_AUTO_INTERVAL_MINUTES,
    embedRequestsPerMinute: parsed.DOCUMENT_EMBED_REQUESTS_PER_MINUTE,
    embedCooldownMinutes: parsed.DOCUMENT_EMBED_COOLDOWN_MINUTES,
    embedMaxRetries: parsed.DOCUMENT_EMBED_MAX_RETRIES,
    embedBackoffBaseMs: parsed.DOCUMENT_EMBED_BACKOFF_BASE_MS,
    embedBackoffMaxMs: parsed.DOCUMENT_EMBED_BACKOFF_MAX_MS,
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
