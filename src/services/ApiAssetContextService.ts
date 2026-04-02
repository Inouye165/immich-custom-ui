import type { AssetContextResponse } from '../types';
import type { AssetContextService } from './AssetContextService';

interface ErrorResponse {
  message?: string;
}

export class ApiAssetContextService implements AssetContextService {
  private readonly cache = new Map<string, AssetContextResponse>();

  private readonly inFlight = new Map<string, Promise<AssetContextResponse>>();

  async getAssetContext(
    assetId: string,
    options: { includeAiSummary?: boolean } = {},
  ): Promise<AssetContextResponse> {
    const cacheKey = `${assetId}:${options.includeAiSummary ? 'summary' : 'base'}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const activeRequest = this.inFlight.get(cacheKey);
    if (activeRequest) {
      return activeRequest;
    }

    const url = new URL(`/api/assets/${encodeURIComponent(assetId)}/context`, window.location.origin);
    if (options.includeAiSummary) {
      url.searchParams.set('includeAiSummary', 'true');
    }

    const request = fetch(url.pathname + url.search, {
      method: 'GET',
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await safeParseJson(response)) as ErrorResponse | null;
          throw new Error(payload?.message?.trim() || 'Asset details request failed.');
        }

        const payload = (await response.json()) as AssetContextResponse;
        this.cache.set(cacheKey, payload);
        if (options.includeAiSummary && payload.aiSummary) {
          this.cache.set(`${assetId}:base`, payload);
        }
        return payload;
      })
      .finally(() => {
        this.inFlight.delete(cacheKey);
      });

    this.inFlight.set(cacheKey, request);
    return request;
  }
}

async function safeParseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}