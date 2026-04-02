import type { AssetContextResponse } from '../types';

export interface AssetContextService {
  getAssetContext(assetId: string, options?: { includeAiSummary?: boolean }): Promise<AssetContextResponse>;
}