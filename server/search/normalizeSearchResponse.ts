import type { SearchResponse, SearchResult } from '../../src/types';
import type { ImmichAsset, ImmichSearchResponse } from '../immich/immichTypes';

export function normalizeSearchResponse(
  response: ImmichSearchResponse,
): SearchResponse {
  return {
    results: response.assets.items.map(normalizeAsset),
    total: response.assets.total,
  };
}

function normalizeAsset(asset: ImmichAsset): SearchResult {
  return {
    id: asset.id,
    title: asset.originalFileName,
    thumbnailUrl: `/api/assets/${encodeURIComponent(asset.id)}/thumbnail?size=preview`,
    date: asset.localDateTime || asset.fileCreatedAt || asset.createdAt,
    description: buildDescription(asset),
  };
}

function buildDescription(asset: ImmichAsset): string | undefined {
  const parts: string[] = [];
  const mediaLabel = formatMediaType(asset.type);
  if (mediaLabel) {
    parts.push(mediaLabel);
  }

  const location = [asset.exifInfo?.city, asset.exifInfo?.state, asset.exifInfo?.country]
    .filter(Boolean)
    .join(', ');

  if (location) {
    parts.push(location);
  }

  return parts.length > 0 ? parts.join(' • ') : undefined;
}

function formatMediaType(type: string): string {
  if (type === 'IMAGE') {
    return 'Photo';
  }

  if (type === 'VIDEO') {
    return 'Video';
  }

  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}
