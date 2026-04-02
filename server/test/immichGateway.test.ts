import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LiveImmichGateway,
  UpstreamHttpError,
} from '../immich/ImmichGateway';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LiveImmichGateway', () => {
  it('fetches asset info with the Immich API key header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'asset-1', originalFileName: 'beach.jpg' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const gateway = new LiveImmichGateway('http://immich.local', 'token-123');
    const response = await gateway.getAssetInfo('asset-1');

    expect(response.id).toBe('asset-1');
    expect(fetchMock).toHaveBeenCalledWith('http://immich.local/api/assets/asset-1', {
      headers: {
        'x-api-key': 'token-123',
      },
    });
  });

  it('fetches asset metadata from the metadata endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ source: 'sidecar' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const gateway = new LiveImmichGateway('http://immich.local', 'token-123');
    const response = await gateway.getAssetMetadata('asset-1');

    expect(response).toEqual({ source: 'sidecar' });
    expect(fetchMock).toHaveBeenCalledWith('http://immich.local/api/assets/asset-1/metadata', {
      headers: {
        'x-api-key': 'token-123',
      },
    });
  });

  it('maps upstream failures for asset info requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Asset not found' }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    const gateway = new LiveImmichGateway('http://immich.local', 'token-123');

    await expect(gateway.getAssetInfo('missing')).rejects.toEqual(
      expect.objectContaining<Partial<UpstreamHttpError>>({
        message: 'Asset not found',
        status: 404,
      }),
    );
  });
});