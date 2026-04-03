import { ConfigurationError, type ServerConfig } from '../config';
import { UpstreamHttpError } from '../immich/ImmichGateway';
import type { PaperlessSearchResponse } from './paperlessTypes';

export interface PaperlessGateway {
  searchDocuments(query: string, page?: number): Promise<PaperlessSearchResponse>;
  fetchThumbnail(documentId: number): Promise<Response>;
  fetchPreview(documentId: number): Promise<Response>;
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
}

export function createLivePaperlessGateway(config: ServerConfig): PaperlessGateway {
  const missing: string[] = [];
  if (!config.paperlessBaseUrl) missing.push('PAPERLESS_BASE_URL');
  if (!config.paperlessApiToken) missing.push('PAPERLESS_API_TOKEN');
  if (missing.length > 0) {
    throw new ConfigurationError(
      `Paperless is not configured. Missing env: ${missing.join(', ')}.`,
    );
  }
  return new LivePaperlessGateway(config.paperlessBaseUrl!, config.paperlessApiToken!);
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
