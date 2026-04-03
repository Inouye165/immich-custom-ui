import type { QdrantClient } from '@qdrant/js-client-rest';
import type { EmbeddingService } from './EmbeddingService';
import type { VectorConfig } from './VectorConfig';

export interface SemanticDocHit {
  docId: number;
  score: number;
  snippet: string;
  title: string;
  createdDate: string;
}

interface ChunkPayload {
  documentId: number;
  chunkIndex: number;
  documentTitle: string;
  chunkText: string;
  sourceCreatedAt: string;
}

/**
 * Queries Qdrant for semantically similar document chunks,
 * then aggregates chunk-level hits up to document-level results.
 */
export class DocumentSemanticSearchService {
  private readonly qdrant: QdrantClient;
  private readonly embedding: EmbeddingService;
  private readonly config: VectorConfig;

  constructor(
    qdrant: QdrantClient,
    embedding: EmbeddingService,
    config: VectorConfig,
  ) {
    this.qdrant = qdrant;
    this.embedding = embedding;
    this.config = config;
  }

  async searchSemantic(query: string, limit = 20): Promise<SemanticDocHit[]> {
    const [queryVector] = await this.embedding.embed([query]);

    // Retrieve more chunks than the doc limit to ensure good aggregation
    const chunkLimit = Math.min(limit * 5, 100);

    const results = await this.qdrant.search(this.config.collection, {
      vector: queryVector,
      limit: chunkLimit,
      with_payload: true,
      score_threshold: 0.25,
    });

    // Aggregate chunk hits → best hit per document
    const docMap = new Map<number, SemanticDocHit>();

    for (const point of results) {
      const payload = point.payload as unknown as ChunkPayload;
      if (!payload?.documentId) continue;

      const existing = docMap.get(payload.documentId);
      if (!existing || point.score > existing.score) {
        docMap.set(payload.documentId, {
          docId: payload.documentId,
          score: point.score,
          snippet: payload.chunkText ?? '',
          title: payload.documentTitle ?? '',
          createdDate: payload.sourceCreatedAt ?? '',
        });
      }
    }

    return [...docMap.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
