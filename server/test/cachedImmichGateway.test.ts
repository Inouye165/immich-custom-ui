import { describe, expect, it, vi } from 'vitest';
import { CachedImmichGateway } from '../immich/CachedImmichGateway';
import type { ImmichGateway } from '../immich/ImmichGateway';

function createInnerGateway(): ImmichGateway {
  return {
    getAssetInfo: vi.fn().mockResolvedValue({ id: 'asset-1', originalFileName: 'one.jpg' }),
    getAssetMetadata: vi.fn().mockResolvedValue({ source: 'sidecar' }),
    searchSmart: vi.fn().mockResolvedValue({
      albums: null,
      assets: { count: 0, items: [], nextPage: null, total: 0 },
    }),
    fetchThumbnail: vi.fn(),
    fetchVideoPlayback: vi.fn(),
    trashAssets: vi.fn(),
  };
}

describe('CachedImmichGateway', () => {
  it('reuses cached asset info for repeated requests', async () => {
    const assetId = `asset-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const inner = createInnerGateway();
    const gateway = new CachedImmichGateway(inner);

    await gateway.getAssetInfo(assetId);
    await gateway.getAssetInfo(assetId);

    expect(inner.getAssetInfo).toHaveBeenCalledTimes(1);
  });
});