import { ConfigurationError, type PaperlessConfig } from '../config';
import { UpstreamHttpError } from '../immich/ImmichGateway';
import type { PaperlessSearchResponse } from './paperlessTypes';

export interface PaperlessGateway {
  searchDocuments(query: string, page?: number): Promise<PaperlessSearchResponse>;
  listDocuments(page?: number): Promise<PaperlessSearchResponse>;
  fetchThumbnail(documentId: number): Promise<Response>;
  fetchPreview(documentId: number): Promise<Response>;
  deleteDocument(documentId: number): Promise<void>;
}

export class LivePaperlessGateway implements PaperlessGateway {
  private readonly baseUrl: string;

  private readonly token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  private headers(): Record<string, string> {
    return { Authorization: `Token ${this.token}` };
  }

  async searchDocuments(query: string, page = 1): Promise<PaperlessSearchResponse> {
    const url = new URL(`${this.baseUrl}/api/documents/`);
    url.searchParams.set('query', query);
    url.searchParams.set('page', String(page));

    const response = await fetch(url, { headers: this.headers() });
    if (!response.ok) {
      throw await buildUpstreamError(response, 'document-search');
    }
    return (await response.json()) as PaperlessSearchResponse;
  }

  async listDocuments(page = 1): Promise<PaperlessSearchResponse> {
    const url = new URL(`${this.baseUrl}/api/documents/`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('ordering', '-created');

    const response = await fetch(url, { headers: this.headers() });
    if (!response.ok) {
      throw await buildUpstreamError(response, 'document-list');
    }
    return (await response.json()) as PaperlessSearchResponse;
  }

  async fetchThumbnail(documentId: number): Promise<Response> {
    const response = await fetch(
      `${this.baseUrl}/api/documents/${documentId}/thumb/`,
      { headers: this.headers() },
    );
    if (!response.ok) {
      throw await buildUpstreamError(response, 'document-thumbnail');
    }
    return response;
  }

  async fetchPreview(documentId: number): Promise<Response> {
    const response = await fetch(
      `${this.baseUrl}/api/documents/${documentId}/preview/`,
      { headers: this.headers() },
    );
    if (!response.ok) {
      throw await buildUpstreamError(response, 'document-preview');
    }
    return response;
  }

  async deleteDocument(documentId: number): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/documents/${documentId}/`,
      { method: 'DELETE', headers: this.headers() },
    );
    if (!response.ok) {
      throw await buildUpstreamError(response, 'document-delete');
    }
  }
}

/** Create gateway from PaperlessConfig (independent of Immich). */
export function createPaperlessGatewayFromConfig(config: PaperlessConfig): PaperlessGateway {
  return new LivePaperlessGateway(config.baseUrl, config.apiToken);
}

/** @deprecated Use createPaperlessGatewayFromConfig with getPaperlessConfig(). */
export function createLivePaperlessGateway(config: { paperlessBaseUrl?: string; paperlessApiToken?: string }): PaperlessGateway {
  if (!config.paperlessBaseUrl || !config.paperlessApiToken) {
    throw new ConfigurationError(
      'Paperless is not configured. Set PAPERLESS_BASE_URL and PAPERLESS_API_TOKEN.',
    );
  }
  return new LivePaperlessGateway(config.paperlessBaseUrl, config.paperlessApiToken);
}

async function buildUpstreamError(
  response: Response,
  operation: string,
): Promise<UpstreamHttpError> {
  let body = '';
  try {
    body = await response.text();
  } catch {
    // ignore
  }
  const detail = body.length > 0 && body.length < 200 ? `: ${body}` : '';
  return new UpstreamHttpError(
    response.status,
    `Paperless ${operation} failed with status ${response.status}${detail}`,
  );
}
