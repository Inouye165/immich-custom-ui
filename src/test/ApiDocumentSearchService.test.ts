import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiDocumentSearchService } from '../services/ApiDocumentSearchService';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ApiDocumentSearchService', () => {
  it('fetches document search results', async () => {
    const mockResponse = {
      results: [
        {
          id: 1,
          title: 'Invoice',
          createdDate: '2024-01-15',
          thumbnailUrl: '/api/documents/1/thumb',
          previewUrl: '/api/documents/1/preview',
        },
      ],
      total: 1,
      hasMore: false,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const service = new ApiDocumentSearchService();
    const result = await service.searchDocuments('invoice');

    expect(result.total).toBe(1);
    expect(result.results[0].title).toBe('Invoice');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('throws on non-ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Paperless is not configured.' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const service = new ApiDocumentSearchService();
    await expect(service.searchDocuments('test')).rejects.toThrow(
      'Paperless is not configured.',
    );
  });

  it('includes page parameter when page > 1', async () => {
    const mockResponse = { results: [], total: 0, hasMore: false };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const service = new ApiDocumentSearchService();
    await service.searchDocuments('test', 3);

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get('page')).toBe('3');
  });

  it('omits page parameter for default page 1', async () => {
    const mockResponse = { results: [], total: 0, hasMore: false };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const service = new ApiDocumentSearchService();
    await service.searchDocuments('test');

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.has('page')).toBe(false);
  });

  it('uses a fallback message when error response has no body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('', { status: 502 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const service = new ApiDocumentSearchService();
    await expect(service.searchDocuments('test')).rejects.toThrow(
      'Document search failed.',
    );
  });
});
