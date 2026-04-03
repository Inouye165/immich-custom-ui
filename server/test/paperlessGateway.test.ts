import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigurationError } from '../config';
import { UpstreamHttpError } from '../immich/ImmichGateway';
import {
  LivePaperlessGateway,
  createLivePaperlessGateway,
} from '../paperless/PaperlessGateway';

const BASE_URL = 'http://paperless:8000';
const TOKEN = 'test-token-123';
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('createLivePaperlessGateway', () => {
  it('throws ConfigurationError naming PAPERLESS_BASE_URL when url is missing', () => {
    expect(() =>
      createLivePaperlessGateway({
        paperlessBaseUrl: undefined,
        paperlessApiToken: TOKEN,
      } as never),
    ).toThrow(ConfigurationError);

    try {
      createLivePaperlessGateway({
        paperlessBaseUrl: undefined,
        paperlessApiToken: TOKEN,
      } as never);
    } catch (e) {
      expect((e as Error).message).toContain('PAPERLESS_BASE_URL');
      expect((e as Error).message).not.toContain('PAPERLESS_API_TOKEN');
    }
  });

  it('throws ConfigurationError naming PAPERLESS_API_TOKEN when token is missing', () => {
    try {
      createLivePaperlessGateway({
        paperlessBaseUrl: BASE_URL,
        paperlessApiToken: undefined,
      } as never);
    } catch (e) {
      expect((e as Error).message).toContain('PAPERLESS_API_TOKEN');
      expect((e as Error).message).not.toContain('PAPERLESS_BASE_URL');
    }
  });

  it('throws ConfigurationError naming both vars when both are missing', () => {
    try {
      createLivePaperlessGateway({
        paperlessBaseUrl: undefined,
        paperlessApiToken: undefined,
      } as never);
    } catch (e) {
      expect((e as Error).message).toContain('PAPERLESS_BASE_URL');
      expect((e as Error).message).toContain('PAPERLESS_API_TOKEN');
    }
  });

  it('returns a gateway instance when config is complete', () => {
    const config = {
      paperlessBaseUrl: BASE_URL,
      paperlessApiToken: TOKEN,
    } as never;

    const gateway = createLivePaperlessGateway(config);
    expect(gateway).toBeInstanceOf(LivePaperlessGateway);
  });
});

describe('LivePaperlessGateway', () => {
  const gateway = new LivePaperlessGateway(BASE_URL, TOKEN);

  it('searchDocuments sends correct url, auth header, and returns parsed response', async () => {
    const mockBody = {
      count: 1,
      next: null,
      previous: null,
      results: [{ id: 42, title: 'Test Doc', created: '2024-01-01T00:00:00Z', added: '2024-01-02T00:00:00Z', correspondent: null, document_type: null, archive_serial_number: null, content: 'hello' }],
    };

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockBody), { status: 200 }),
    );

    const result = await gateway.searchDocuments('test', 2);

    expect(result.count).toBe(1);
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const url = call[0] instanceof URL ? call[0] : new URL(call[0] as string);
    expect(url.pathname).toBe('/api/documents/');
    expect(url.searchParams.get('query')).toBe('test');
    expect(url.searchParams.get('page')).toBe('2');
    expect(call[1].headers.Authorization).toBe(`Token ${TOKEN}`);
  });

  it('searchDocuments throws UpstreamHttpError on non-OK response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('Unauthorized', { status: 401 }),
    );

    await expect(gateway.searchDocuments('test')).rejects.toThrow(UpstreamHttpError);
    await expect(gateway.searchDocuments('test')).rejects.toThrow(/document-search/);
  });

  it('fetchThumbnail throws UpstreamHttpError on 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('Not Found', { status: 404 }),
    );

    await expect(gateway.fetchThumbnail(99)).rejects.toThrow(UpstreamHttpError);
    await expect(gateway.fetchThumbnail(99)).rejects.toThrow(/document-thumbnail/);
  });

  it('fetchPreview throws UpstreamHttpError with operation name on failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('Server Error', { status: 500 }),
    );

    await expect(gateway.fetchPreview(42)).rejects.toThrow(UpstreamHttpError);
    await expect(gateway.fetchPreview(42)).rejects.toThrow(/document-preview/);
  });

  it('fetchThumbnail returns the response on success', async () => {
    const body = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(body, { status: 200, headers: { 'Content-Type': 'image/png' } }),
    );

    const resp = await gateway.fetchThumbnail(1);
    expect(resp.status).toBe(200);
  });
});
