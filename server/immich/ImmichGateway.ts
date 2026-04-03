import { ConfigurationError, getServerConfig } from '../config';
import { CachedImmichGateway } from './CachedImmichGateway';
import type {
  ImmichAssetInfo,
  ImmichAssetMetadata,
  ImmichSearchResponse,
  ImmichSmartSearchPayload,
  ThumbnailSize,
} from './immichTypes';

export interface ImmichGateway {
  getAssetInfo(assetId: string): Promise<ImmichAssetInfo>;
  getAssetMetadata(assetId: string): Promise<ImmichAssetMetadata>;
  searchSmart(payload: ImmichSmartSearchPayload): Promise<ImmichSearchResponse>;
  fetchThumbnail(assetId: string, size: ThumbnailSize): Promise<Response>;
  fetchVideoPlayback(assetId: string, range?: string): Promise<Response>;
  trashAssets(ids: string[]): Promise<void>;
}

export class UpstreamHttpError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'UpstreamHttpError';
    this.status = status;
  }
}

export class LiveImmichGateway implements ImmichGateway {
  private readonly baseUrl: string;

  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async searchSmart(
    payload: ImmichSmartSearchPayload,
  ): Promise<ImmichSearchResponse> {
    const response = await fetch(`${this.baseUrl}/api/search/smart`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw await buildUpstreamError(response, 'search');
    }

    return (await response.json()) as ImmichSearchResponse;
  }

  async getAssetInfo(assetId: string): Promise<ImmichAssetInfo> {
    const response = await fetch(`${this.baseUrl}/api/assets/${encodeURIComponent(assetId)}`, {
      headers: {
        'x-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw await buildUpstreamError(response, 'asset-info');
    }

    return (await response.json()) as ImmichAssetInfo;
  }

  async getAssetMetadata(assetId: string): Promise<ImmichAssetMetadata> {
    const response = await fetch(
      `${this.baseUrl}/api/assets/${encodeURIComponent(assetId)}/metadata`,
      {
        headers: {
          'x-api-key': this.apiKey,
        },
      },
    );

    if (!response.ok) {
      throw await buildUpstreamError(response, 'asset-metadata');
    }

    return (await response.json()) as ImmichAssetMetadata;
  }

  async fetchThumbnail(assetId: string, size: ThumbnailSize): Promise<Response> {
    const url = new URL(`${this.baseUrl}/api/assets/${assetId}/thumbnail`);
    url.searchParams.set('size', size);

    const response = await fetch(url, {
      headers: {
        'x-api-key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw await buildUpstreamError(response, 'thumbnail');
    }

    return response;
  }

  async fetchVideoPlayback(assetId: string, range?: string): Promise<Response> {
    const url = `${this.baseUrl}/api/assets/${encodeURIComponent(assetId)}/video/playback`;
    const headers: Record<string, string> = { 'x-api-key': this.apiKey };
    if (range) {
      headers['range'] = range;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw await buildUpstreamError(response, 'thumbnail');
    }

    return response;
  }

  async trashAssets(ids: string[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/assets`, {
      method: 'DELETE',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify({ ids, force: false }),
    });

    if (!response.ok) {
      throw await buildUpstreamError(response, 'trash');
    }
  }
}

export function createLiveImmichGateway(): ImmichGateway {
  const { immichBaseUrl, immichApiKey } = getServerConfig();
  return new CachedImmichGateway(new LiveImmichGateway(immichBaseUrl, immichApiKey));
}

async function buildUpstreamError(
  response: Response,
  operation: 'asset-info' | 'asset-metadata' | 'search' | 'thumbnail',
): Promise<UpstreamHttpError> {
  if (response.status === 401 || response.status === 403) {
    return new UpstreamHttpError(
      response.status,
      'The photo library rejected the configured API key.',
    );
  }

  const fallbackMessage =
    operation === 'search'
      ? 'Search is unavailable right now.'
      : operation === 'thumbnail'
        ? 'Thumbnail retrieval is unavailable right now.'
        : operation === 'asset-info'
          ? 'Asset details are unavailable right now.'
          : 'Asset metadata is unavailable right now.';

  try {
    const body = (await response.json()) as { message?: string };
    const message = body.message?.trim() || fallbackMessage;
    return new UpstreamHttpError(response.status, message);
  } catch {
    return new UpstreamHttpError(response.status, fallbackMessage);
  }
}

export function isRecoverableServerError(error: unknown): boolean {
  return error instanceof ConfigurationError || error instanceof UpstreamHttpError;
}
