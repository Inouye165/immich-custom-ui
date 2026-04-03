import { describe, expect, it, vi } from 'vitest';
import type { PaperlessGateway } from '../paperless/PaperlessGateway';
import type { DocumentSemanticSearchService, SemanticDocHit } from '../vector/DocumentSemanticSearchService';
import { HybridDocumentSearchService } from '../vector/HybridDocumentSearchService';

function createMockPaperless(
  results: { id: number; title: string; created: string; content?: string }[] = [],
  count = 0,
  next: string | null = null,
): PaperlessGateway {
  return {
    searchDocuments: vi.fn().mockResolvedValue({ results, count, next }),
    listDocuments: vi.fn().mockResolvedValue({ results: [], count: 0, next: null }),
  } as unknown as PaperlessGateway;
}

function createMockSemantic(
  hits: SemanticDocHit[] = [],
): DocumentSemanticSearchService {
  return {
    searchSemantic: vi.fn().mockResolvedValue(hits),
  } as unknown as DocumentSemanticSearchService;
}

const KW_RESULTS = [
  { id: 1, title: 'Invoice Jan', created: '2024-01-01', content: 'Invoice for January services.' },
  { id: 2, title: 'Receipt Feb', created: '2024-02-01', content: 'Payment receipt.' },
];

const SEMANTIC_HITS: SemanticDocHit[] = [
  { docId: 2, score: 0.92, snippet: 'Matching receipt chunk.', title: 'Receipt Feb', createdDate: '2024-02-01' },
  { docId: 3, score: 0.88, snippet: 'Unique semantic result.', title: 'Contract', createdDate: '2024-03-01' },
];

describe('HybridDocumentSearchService', () => {
  describe('keyword mode', () => {
    it('returns keyword results with mode=keyword and no fallback', async () => {
      const paperless = createMockPaperless(KW_RESULTS, 2);
      const service = new HybridDocumentSearchService(paperless, null);

      const result = await service.search('invoice', 1, 'keyword');

      expect(result.mode).toBe('keyword');
      expect(result.fallback).toBe(false);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].title).toBe('Invoice Jan');
    });
  });

  describe('semantic mode', () => {
    it('returns fallback when semantic service is null', async () => {
      const paperless = createMockPaperless();
      const service = new HybridDocumentSearchService(paperless, null);

      const result = await service.search('invoice', 1, 'semantic');

      expect(result.mode).toBe('semantic');
      expect(result.fallback).toBe(true);
      expect(result.fallbackReason).toContain('not available');
      expect(result.results).toEqual([]);
    });

    it('returns semantic results when service is available', async () => {
      const paperless = createMockPaperless();
      const semantic = createMockSemantic(SEMANTIC_HITS);
      const service = new HybridDocumentSearchService(paperless, semantic);

      const result = await service.search('receipt', 1, 'semantic');

      expect(result.mode).toBe('semantic');
      expect(result.fallback).toBe(false);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].title).toBe('Receipt Feb');
    });

    it('returns fallback when semantic service throws', async () => {
      const paperless = createMockPaperless();
      const semantic = {
        searchSemantic: vi.fn().mockRejectedValue(new Error('Connection refused')),
      } as unknown as DocumentSemanticSearchService;
      const service = new HybridDocumentSearchService(paperless, semantic);

      const result = await service.search('test', 1, 'semantic');

      expect(result.mode).toBe('semantic');
      expect(result.fallback).toBe(true);
      expect(result.fallbackReason).toContain('unavailable');
    });
  });

  describe('hybrid mode', () => {
    it('fuses keyword and semantic results with RRF', async () => {
      const paperless = createMockPaperless(KW_RESULTS, 2);
      const semantic = createMockSemantic(SEMANTIC_HITS);
      const service = new HybridDocumentSearchService(paperless, semantic);

      const result = await service.search('receipt', 1, 'hybrid');

      expect(result.mode).toBe('hybrid');
      expect(result.fallback).toBe(false);
      // Doc 2 appears in both sources, should be ranked higher
      const ids = result.results.map((r) => r.id);
      expect(ids).toContain(2);
      expect(ids).toContain(1);
      expect(ids).toContain(3);
      // Doc 2 should rank first because it appears in both lists
      expect(ids[0]).toBe(2);
    });

    it('falls back gracefully when semantic is unavailable', async () => {
      const paperless = createMockPaperless(KW_RESULTS, 2);
      const service = new HybridDocumentSearchService(paperless, null);

      const result = await service.search('test', 1, 'hybrid');

      expect(result.mode).toBe('hybrid');
      expect(result.fallback).toBe(true);
      expect(result.fallbackReason).toContain('not configured');
      expect(result.results).toHaveLength(2);
    });

    it('falls back when semantic throws', async () => {
      const paperless = createMockPaperless(KW_RESULTS, 2);
      const semantic = {
        searchSemantic: vi.fn().mockRejectedValue(new Error('Timeout')),
      } as unknown as DocumentSemanticSearchService;
      const service = new HybridDocumentSearchService(paperless, semantic);

      const result = await service.search('test', 1, 'hybrid');

      expect(result.mode).toBe('hybrid');
      expect(result.fallback).toBe(true);
      expect(result.results).toHaveLength(2);
    });

    it('prefers longer semantic snippets in fused results', async () => {
      const shortKw = [{ id: 5, title: 'Doc', created: '2024-01-01', content: 'Short.' }];
      const longSemantic: SemanticDocHit[] = [
        { docId: 5, score: 0.9, snippet: 'A much longer and more descriptive semantic snippet for this document.', title: 'Doc', createdDate: '2024-01-01' },
      ];
      const paperless = createMockPaperless(shortKw, 1);
      const semantic = createMockSemantic(longSemantic);
      const service = new HybridDocumentSearchService(paperless, semantic);

      const result = await service.search('doc', 1, 'hybrid');

      const doc = result.results.find((r) => r.id === 5);
      expect(doc?.snippet).toContain('longer and more descriptive');
    });
  });
});
