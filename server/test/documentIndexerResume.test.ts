import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QdrantClient } from '@qdrant/js-client-rest';
import type { PaperlessGateway } from '../paperless/PaperlessGateway';
import { IndexingStateStore } from '../vector/IndexingStateStore';
import { RateLimitError } from '../vector/EmbeddingRateLimiter';
import { DocumentIndexer } from '../vector/DocumentIndexer';
import type { EmbeddingService } from '../vector/EmbeddingService';
import type { VectorConfig } from '../vector/VectorConfig';

function createGateway(documentContent: string): PaperlessGateway {
  return {
    searchDocuments: vi.fn(),
    fetchThumbnail: vi.fn(),
    fetchPreview: vi.fn(),
    deleteDocument: vi.fn(),
    listDocuments: vi.fn().mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 1,
          title: 'Large Doc',
          created: '2024-01-01',
          added: '2024-01-01',
          modified: '2024-01-02',
          correspondent: null,
          document_type: null,
          archive_serial_number: null,
          content: documentContent,
          tags: [],
        },
      ],
    }),
  } as unknown as PaperlessGateway;
}

function createQdrant(): QdrantClient {
  return {
    getCollections: vi.fn().mockResolvedValue({ collections: [{ name: 'documents' }] }),
    scroll: vi.fn().mockResolvedValue({ points: [], next_page_offset: null }),
    upsert: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  } as unknown as QdrantClient;
}

function createConfig(): VectorConfig {
  return {
    qdrantUrl: 'http://localhost:6333',
    qdrantApiKey: undefined,
    collection: 'documents',
    embeddingProvider: 'gemini',
    embeddingModel: 'gemini-embedding-001',
    embeddingApiKey: undefined,
    embeddingBaseUrl: undefined,
    indexBatchSize: 2,
    schedulerBatchSize: 5,
    indexChunkSize: 20,
    indexChunkOverlap: 0,
    schemaVersion: 'v1',
    autoIndexEnabled: false,
    autoIndexIntervalMinutes: 15,
    embedRequestsPerMinute: 10,
    embedCooldownMinutes: 5,
    embedMaxRetries: 5,
    embedBackoffBaseMs: 2000,
    embedBackoffMaxMs: 120000,
  };
}

describe('DocumentIndexer resume', () => {
  let runtimeDir: string;

  beforeEach(async () => {
    runtimeDir = await mkdtemp(path.join(os.tmpdir(), 'idx-resume-'));
  });

  afterEach(async () => {
    await rm(runtimeDir, { recursive: true, force: true });
  });

  it('resumes a partially indexed document from the saved chunk offset', async () => {
    const gateway = createGateway(
      'Sentence one. Sentence two. Sentence three. Sentence four. Sentence five. Sentence six.',
    );
    const qdrant = createQdrant();
    const stateStore = new IndexingStateStore(runtimeDir);
    await stateStore.load();
    stateStore.markPending(1, 'Large Doc', 'placeholder');

    let embedCallCount = 0;
    const embed = vi.fn<EmbeddingService['embed']>().mockImplementation(async (texts) => {
      embedCallCount += 1;
      if (embedCallCount === 2) {
        throw new RateLimitError('429 rate limit', 1000);
      }

      return texts.map((_, index) => [embedCallCount, index + 1]);
    });
    const embedding: EmbeddingService = {
      embed,
      dimensions: () => 1,
    };

    const indexer = new DocumentIndexer(gateway, qdrant, embedding, createConfig(), stateStore);

    await expect(indexer.indexSingleDocument(1)).rejects.toThrow(RateLimitError);
    expect(stateStore.getRecord(1)?.completedChunks).toBe(2);
    expect(vi.mocked(qdrant.upsert)).toHaveBeenCalledTimes(1);

    await indexer.indexSingleDocument(1);
    await stateStore.flush();

    const record = stateStore.getRecord(1);
    expect(record?.status).toBe('indexed');
    expect(record?.totalChunks).toBe(record?.completedChunks);
    expect(embed.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(embed.mock.calls[2]?.[0]).not.toEqual(embed.mock.calls[0]?.[0]);
    expect(vi.mocked(qdrant.upsert).mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});