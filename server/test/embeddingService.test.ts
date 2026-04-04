import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmbeddingService } from '../vector/EmbeddingService';
import type { VectorConfig } from '../vector/VectorConfig';

function createVectorConfig(overrides: Partial<VectorConfig> = {}): VectorConfig {
  return {
    qdrantUrl: 'http://localhost:6333',
    qdrantApiKey: undefined,
    collection: 'documents',
    embeddingProvider: 'gemini',
    embeddingModel: 'gemini-embedding-001',
    embeddingApiKey: undefined,
    embeddingBaseUrl: undefined,
    indexBatchSize: 50,
    schedulerBatchSize: 5,
    indexChunkSize: 1000,
    indexChunkOverlap: 200,
    schemaVersion: 'v1',
    autoIndexEnabled: false,
    autoIndexIntervalMinutes: 15,
    embedRequestsPerMinute: 10,
    embedCooldownMinutes: 5,
    embedMaxRetries: 5,
    embedBackoffBaseMs: 2000,
    embedBackoffMaxMs: 120000,
    ...overrides,
  };
}

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  vi.unstubAllGlobals();
});

describe('createEmbeddingService', () => {
  it('uses Gemini batch embeddings with retrieval query task type', async () => {
    process.env.GEMINI_API_KEY = 'gem-test-key';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ embeddings: [{ values: [0.1, 0.2, 0.3] }] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const service = createEmbeddingService(createVectorConfig());
    const result = await service.embed(['find dobby vet info'], 'query');

    expect(result).toEqual([[0.1, 0.2, 0.3]]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/models/gemini-embedding-001:batchEmbedContents?key=gem-test-key');

    const body = JSON.parse(String(options.body)) as {
      requests: Array<{ taskType?: string; model: string }>;
    };
    expect(body.requests[0]?.model).toBe('models/gemini-embedding-001');
    expect(body.requests[0]?.taskType).toBe('RETRIEVAL_QUERY');
  });

  it('defaults ollama to the local OpenAI-compatible endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ data: [{ embedding: [0.5, 0.6], index: 0 }], model: 'nomic-embed-text' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const service = createEmbeddingService(createVectorConfig({
      embeddingProvider: 'ollama',
      embeddingModel: 'nomic-embed-text',
    }));

    const result = await service.embed(['index this document']);

    expect(result).toEqual([[0.5, 0.6]]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('http://localhost:11434/v1/embeddings');
  });
});