import { afterEach, describe, expect, it } from 'vitest';
import { getPaperlessConfig, getVectorConfig } from '../config';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('getPaperlessConfig', () => {
  it('returns null when Paperless env vars are missing', () => {
    delete process.env.PAPERLESS_BASE_URL;
    delete process.env.PAPERLESS_API_TOKEN;

    expect(getPaperlessConfig()).toBeNull();
  });

  it('returns config when both vars are set', () => {
    process.env.PAPERLESS_BASE_URL = 'http://paperless:8000';
    process.env.PAPERLESS_API_TOKEN = 'tok-123';

    const config = getPaperlessConfig();
    expect(config).toEqual({
      baseUrl: 'http://paperless:8000',
      apiToken: 'tok-123',
    });
  });

  it('strips trailing slash from base URL', () => {
    process.env.PAPERLESS_BASE_URL = 'http://paperless:8000/';
    process.env.PAPERLESS_API_TOKEN = 'tok-123';

    expect(getPaperlessConfig()?.baseUrl).toBe('http://paperless:8000');
  });

  it('returns null when only base URL is set', () => {
    process.env.PAPERLESS_BASE_URL = 'http://paperless:8000';
    delete process.env.PAPERLESS_API_TOKEN;

    expect(getPaperlessConfig()).toBeNull();
  });
});

describe('getVectorConfig', () => {
  it('returns null when DOCUMENT_VECTOR_ENABLED is not true', () => {
    delete process.env.DOCUMENT_VECTOR_ENABLED;
    expect(getVectorConfig()).toBeNull();
  });

  it('returns null when enabled but QDRANT_URL is missing', () => {
    process.env.DOCUMENT_VECTOR_ENABLED = 'true';
    delete process.env.QDRANT_URL;
    process.env.DOCUMENT_EMBEDDING_PROVIDER = 'openai';
    process.env.DOCUMENT_EMBEDDING_MODEL = 'text-embedding-3-small';

    expect(getVectorConfig()).toBeNull();
  });

  it('returns null when enabled but embedding model is missing', () => {
    process.env.DOCUMENT_VECTOR_ENABLED = 'true';
    process.env.QDRANT_URL = 'http://localhost:6333';
    process.env.DOCUMENT_EMBEDDING_PROVIDER = 'openai';
    delete process.env.DOCUMENT_EMBEDDING_MODEL;

    expect(getVectorConfig()).toBeNull();
  });

  it('returns full config with defaults when fully configured', () => {
    process.env.DOCUMENT_VECTOR_ENABLED = 'true';
    process.env.QDRANT_URL = 'http://localhost:6333';
    process.env.DOCUMENT_EMBEDDING_PROVIDER = 'openai';
    process.env.DOCUMENT_EMBEDDING_MODEL = 'text-embedding-3-small';
    process.env.DOCUMENT_EMBEDDING_API_KEY = 'sk-test';
    process.env.DOCUMENT_EMBEDDING_BASE_URL = 'https://api.openai.com/v1';
    delete process.env.DOCUMENT_INDEX_BATCH_SIZE;
    delete process.env.DOCUMENT_SCHEDULER_BATCH_SIZE;
    delete process.env.DOCUMENT_INDEX_CHUNK_SIZE;
    delete process.env.DOCUMENT_INDEX_CHUNK_OVERLAP;

    const config = getVectorConfig();
    expect(config).not.toBeNull();
    expect(config!.qdrantUrl).toBe('http://localhost:6333');
    expect(config!.collection).toBe('documents');
    expect(config!.embeddingModel).toBe('text-embedding-3-small');
    expect(config!.embeddingApiKey).toBe('sk-test');
    expect(config!.indexBatchSize).toBe(50);
    expect(config!.schedulerBatchSize).toBe(5);
    expect(config!.indexChunkSize).toBe(1000);
    expect(config!.indexChunkOverlap).toBe(200);
    expect(config!.schemaVersion).toBe('v1');
  });

  it('uses custom collection name and schema version', () => {
    process.env.DOCUMENT_VECTOR_ENABLED = 'true';
    process.env.QDRANT_URL = 'http://localhost:6333';
    process.env.DOCUMENT_EMBEDDING_PROVIDER = 'ollama';
    process.env.DOCUMENT_EMBEDDING_MODEL = 'nomic-embed-text';
    process.env.DOCUMENT_VECTOR_COLLECTION = 'my_docs';
    process.env.VECTOR_SCHEMA_VERSION = 'v2';

    const config = getVectorConfig();
    expect(config!.collection).toBe('my_docs');
    expect(config!.schemaVersion).toBe('v2');
  });

  it('is case-insensitive for the enabled flag', () => {
    process.env.DOCUMENT_VECTOR_ENABLED = 'True';
    process.env.QDRANT_URL = 'http://localhost:6333';
    process.env.DOCUMENT_EMBEDDING_PROVIDER = 'openai';
    process.env.DOCUMENT_EMBEDDING_MODEL = 'model';

    expect(getVectorConfig()).not.toBeNull();
  });

  it('works independently of Immich config', () => {
    // Immich vars are missing — should not affect vector config
    delete process.env.IMMICH_BASE_URL;
    delete process.env.IMMICH_API_KEY;
    process.env.DOCUMENT_VECTOR_ENABLED = 'true';
    process.env.QDRANT_URL = 'http://localhost:6333';
    process.env.DOCUMENT_EMBEDDING_PROVIDER = 'openai';
    process.env.DOCUMENT_EMBEDDING_MODEL = 'model';

    expect(getVectorConfig()).not.toBeNull();
  });
});
