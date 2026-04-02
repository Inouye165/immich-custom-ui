import type { AssetContextResponse } from '../types';
import type { AssetContextService } from './AssetContextService';

interface ErrorResponse {
  message?: string;
}

export class ApiAssetContextService implements AssetContextService {
  async getAssetContext(
    assetId: string,
    options: { includeAiSummary?: boolean } = {},
  ): Promise<AssetContextResponse> {
    const url = new URL(`/api/assets/${encodeURIComponent(assetId)}/context`, window.location.origin);
    if (options.includeAiSummary) {
      url.searchParams.set('includeAiSummary', 'true');
    }

    const response = await fetch(url.pathname + url.search, {
      method: 'GET',
    });

    if (!response.ok) {
      const payload = (await safeParseJson(response)) as ErrorResponse | null;
      throw new Error(payload?.message?.trim() || 'Asset details request failed.');
    }

    return (await response.json()) as AssetContextResponse;
  }
}

async function safeParseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}