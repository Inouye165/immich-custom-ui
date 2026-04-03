import type { PaperlessGateway } from '../paperless/PaperlessGateway';
import type { DocumentSemanticSearchService, SemanticDocHit } from './DocumentSemanticSearchService';

export interface HybridSearchResult {
  results: HybridDocResult[];
  total: number;
  hasMore: boolean;
  mode: 'keyword' | 'semantic' | 'hybrid';
  fallback: boolean;
  fallbackReason?: string;
}

export interface HybridDocResult {
  id: number;
  title: string;
  createdDate: string;
  thumbnailUrl: string;
  previewUrl: string;
  snippet?: string;
  score?: number;
}

const RRF_K = 60;

/**
 * Fuses Paperless keyword results with Qdrant semantic results
 * using Reciprocal Rank Fusion (RRF).
 */
export class HybridDocumentSearchService {
  private readonly paperless: PaperlessGateway;
  private readonly semantic: DocumentSemanticSearchService | null;

  constructor(
    paperless: PaperlessGateway,
    semantic: DocumentSemanticSearchService | null,
  ) {
    this.paperless = paperless;
    this.semantic = semantic;
  }

  async search(
    query: string,
    page: number,
    mode: 'keyword' | 'semantic' | 'hybrid',
  ): Promise<HybridSearchResult> {
    if (mode === 'keyword') {
      return this.keywordSearch(query, page);
    }

    if (mode === 'semantic') {
      return this.semanticSearch(query);
    }

    return this.hybridSearch(query, page);
  }

  private async keywordSearch(query: string, page: number): Promise<HybridSearchResult> {
    const raw = await this.paperless.searchDocuments(query, page);
    return {
      results: raw.results.map((doc) => ({
        id: doc.id,
        title: doc.title,
        createdDate: doc.created,
        thumbnailUrl: `/api/documents/${doc.id}/thumb`,
        previewUrl: `/api/documents/${doc.id}/preview`,
        snippet: doc.content ? doc.content.slice(0, 280) : undefined,
      })),
      total: raw.count,
      hasMore: raw.next !== null,
      mode: 'keyword',
      fallback: false,
    };
  }

  private async semanticSearch(query: string): Promise<HybridSearchResult> {
    if (!this.semantic) {
      return {
        results: [],
        total: 0,
        hasMore: false,
        mode: 'semantic',
        fallback: true,
        fallbackReason: 'Semantic search is not available. Enable DOCUMENT_VECTOR_ENABLED and configure Qdrant.',
      };
    }

    try {
      const hits = await this.semantic.searchSemantic(query, 25);
      return {
        results: hits.map((hit) => ({
          id: hit.docId,
          title: hit.title,
          createdDate: hit.createdDate,
          thumbnailUrl: `/api/documents/${hit.docId}/thumb`,
          previewUrl: `/api/documents/${hit.docId}/preview`,
          snippet: hit.snippet || undefined,
          score: hit.score,
        })),
        total: hits.length,
        hasMore: false,
        mode: 'semantic',
        fallback: false,
      };
    } catch (err) {
      console.error('[hybrid-search] Semantic search failed:', err);
      return {
        results: [],
        total: 0,
        hasMore: false,
        mode: 'semantic',
        fallback: true,
        fallbackReason: 'Semantic search is temporarily unavailable.',
      };
    }
  }

  private async hybridSearch(query: string, page: number): Promise<HybridSearchResult> {
    const keywordPromise = this.paperless.searchDocuments(query, page);

    let semanticHits: SemanticDocHit[] = [];
    let semanticFailed = false;
    let fallbackReason: string | undefined;

    if (this.semantic) {
      try {
        semanticHits = await Promise.race([
          this.semantic.searchSemantic(query, 30),
          new Promise<SemanticDocHit[]>((_, reject) =>
            setTimeout(() => reject(new Error('Semantic search timeout')), 10_000),
          ),
        ]);
      } catch (err) {
        console.error('[hybrid-search] Semantic search failed, falling back to keyword-only:', err);
        semanticFailed = true;
        fallbackReason = 'Semantic search is temporarily unavailable. Showing keyword results only.';
      }
    } else {
      semanticFailed = true;
      fallbackReason = 'Semantic search is not configured. Showing keyword results only.';
    }

    const kwResult = await keywordPromise;

    // If semantic failed, return keyword-only with fallback flag
    if (semanticFailed || semanticHits.length === 0) {
      return {
        results: kwResult.results.map((doc) => ({
          id: doc.id,
          title: doc.title,
          createdDate: doc.created,
          thumbnailUrl: `/api/documents/${doc.id}/thumb`,
          previewUrl: `/api/documents/${doc.id}/preview`,
          snippet: doc.content ? doc.content.slice(0, 280) : undefined,
        })),
        total: kwResult.count,
        hasMore: kwResult.next !== null,
        mode: 'hybrid',
        fallback: semanticFailed,
        fallbackReason,
      };
    }

    // Fuse with Reciprocal Rank Fusion
    const fused = this.fuseResults(kwResult.results, semanticHits);

    return {
      results: fused,
      total: Math.max(kwResult.count, fused.length),
      hasMore: kwResult.next !== null,
      mode: 'hybrid',
      fallback: false,
    };
  }

  private fuseResults(
    kwDocs: { id: number; title: string; created: string; content?: string }[],
    semanticHits: SemanticDocHit[],
  ): HybridDocResult[] {
    const scoreMap = new Map<number, { rrfScore: number; result: HybridDocResult }>();

    // Score keyword results by rank
    kwDocs.forEach((doc, rank) => {
      const rrfScore = 1 / (RRF_K + rank + 1);
      scoreMap.set(doc.id, {
        rrfScore,
        result: {
          id: doc.id,
          title: doc.title,
          createdDate: doc.created,
          thumbnailUrl: `/api/documents/${doc.id}/thumb`,
          previewUrl: `/api/documents/${doc.id}/preview`,
          snippet: doc.content ? doc.content.slice(0, 280) : undefined,
        },
      });
    });

    // Add semantic scores by rank
    semanticHits.forEach((hit, rank) => {
      const semanticRrfScore = 1 / (RRF_K + rank + 1);
      const existing = scoreMap.get(hit.docId);

      if (existing) {
        existing.rrfScore += semanticRrfScore;
        // Prefer the semantic snippet if it's longer/better
        if (hit.snippet && (!existing.result.snippet || hit.snippet.length > existing.result.snippet.length)) {
          existing.result.snippet = hit.snippet;
        }
      } else {
        scoreMap.set(hit.docId, {
          rrfScore: semanticRrfScore,
          result: {
            id: hit.docId,
            title: hit.title,
            createdDate: hit.createdDate,
            thumbnailUrl: `/api/documents/${hit.docId}/thumb`,
            previewUrl: `/api/documents/${hit.docId}/preview`,
            snippet: hit.snippet || undefined,
          },
        });
      }
    });

    return [...scoreMap.values()]
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .map((entry) => entry.result);
  }
}
