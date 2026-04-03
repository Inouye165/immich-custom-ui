import { PersistentCache } from '../services/PersistentCache';
import type {
  ImmichAssetInfo,
  ImmichAssetMetadata,
  ImmichSearchResponse,
  ImmichSmartSearchPayload,
  ThumbnailSize,
} from './immichTypes';
import type { ImmichGateway } from './ImmichGateway';

const ASSET_INFO_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const ASSET_METADATA_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;

export class CachedImmichGateway implements ImmichGateway {
  private readonly assetInfoCache = new PersistentCache<ImmichAssetInfo>('immich-asset-info', ASSET_INFO_CACHE_TTL_MS);

  private readonly assetMetadataCache = new PersistentCache<ImmichAssetMetadata>('immich-asset-metadata', ASSET_METADATA_CACHE_TTL_MS);

  private readonly searchCache = new PersistentCache<ImmichSearchResponse>('immich-search', SEARCH_CACHE_TTL_MS);

  private readonly inner: ImmichGateway;

  constructor(inner: ImmichGateway) {
    this.inner = inner;
  }

  async getAssetInfo(assetId: string): Promise<ImmichAssetInfo> {
    const result = await this.assetInfoCache.getOrCreate(assetId, () => this.inner.getAssetInfo(assetId));
    return result.value;
  }

  async getAssetMetadata(assetId: string): Promise<ImmichAssetMetadata> {
    const result = await this.assetMetadataCache.getOrCreate(assetId, () => this.inner.getAssetMetadata(assetId));
    return result.value;
  }

  async searchSmart(payload: ImmichSmartSearchPayload): Promise<ImmichSearchResponse> {
    const cacheKey = JSON.stringify(payload);
    const result = await this.searchCache.getOrCreate(cacheKey, () => this.inner.searchSmart(payload));
    return result.value;
  }

  fetchThumbnail(assetId: string, size: ThumbnailSize): Promise<Response> {
    return this.inner.fetchThumbnail(assetId, size);
  }

  fetchVideoPlayback(assetId: string, range?: string): Promise<Response> {
    return this.inner.fetchVideoPlayback(assetId, range);
  }

  async trashAssets(ids: string[]): Promise<void> {
    await this.inner.trashAssets(ids);
  }
}