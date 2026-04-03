import type {
  AssetDetails,
  AssetMetadata,
  AssetPoint,
} from '../../src/types';
import type {
  ImmichAssetInfo,
  ImmichAssetMetadata,
  ImmichExifInfo,
} from '../immich/immichTypes';

export function normalizeAssetInfo(asset: ImmichAssetInfo): AssetDetails {
  const exif = asset.exifInfo;
  const isVideo = asset.type === 'VIDEO';

  return {
    id: asset.id,
    title: asset.originalFileName,
    mediaType: formatMediaType(asset.type),
    imageUrl: `/api/assets/${encodeURIComponent(asset.id)}/thumbnail?size=fullsize`,
    videoUrl: isVideo ? `/api/assets/${encodeURIComponent(asset.id)}/video/playback` : null,
    thumbnailUrl: `/api/assets/${encodeURIComponent(asset.id)}/thumbnail?size=preview`,
    mimeType: asset.originalMimeType ?? null,
    takenAt: getPreferredTimestamp(asset),
    createdAt: asset.createdAt,
    width: exif?.exifImageWidth ?? asset.width ?? null,
    height: exif?.exifImageHeight ?? asset.height ?? null,
    locationLabel: buildLocationLabel(exif),
  };
}

export function normalizeAssetMetadata(
  asset: ImmichAssetInfo,
  rawMetadata: ImmichAssetMetadata | null,
): AssetMetadata {
  const exif = asset.exifInfo;

  return {
    dateTimeOriginal: exif?.dateTimeOriginal ?? null,
    localDateTime: asset.localDateTime ?? null,
    fileCreatedAt: asset.fileCreatedAt ?? null,
    fileModifiedAt: asset.fileModifiedAt ?? null,
    cameraMake: exif?.make ?? null,
    cameraModel: exif?.model ?? null,
    lensModel: exif?.lensModel ?? null,
    width: exif?.exifImageWidth ?? asset.width ?? null,
    height: exif?.exifImageHeight ?? asset.height ?? null,
    fileType: asset.originalMimeType ?? null,
    fileSizeBytes: exif?.fileSizeInByte ?? null,
    latitude: exif?.latitude ?? null,
    longitude: exif?.longitude ?? null,
    city: exif?.city ?? null,
    state: exif?.state ?? null,
    country: exif?.country ?? null,
    timeZone: exif?.timeZone ?? null,
    exposureTime: exif?.exposureTime ?? null,
    fNumber: exif?.fNumber ?? null,
    focalLength: exif?.focalLength ?? null,
    iso: exif?.iso ?? null,
    description: exif?.description ?? null,
    additional: toPrimitiveMetadata(rawMetadata),
  };
}

export function extractGps(exif?: ImmichExifInfo | null): AssetPoint | null {
  if (typeof exif?.latitude !== 'number' || typeof exif?.longitude !== 'number') {
    return null;
  }

  return {
    latitude: exif.latitude,
    longitude: exif.longitude,
  };
}

function getPreferredTimestamp(asset: ImmichAssetInfo) {
  return (
    asset.exifInfo?.dateTimeOriginal ??
    asset.localDateTime ??
    asset.fileCreatedAt ??
    asset.createdAt ??
    null
  );
}

function buildLocationLabel(exif?: ImmichExifInfo | null) {
  const value = [exif?.city, exif?.state, exif?.country].filter(Boolean).join(', ');
  return value || null;
}

function toPrimitiveMetadata(rawMetadata: ImmichAssetMetadata | null) {
  if (!rawMetadata) {
    return {};
  }

  const additional = Object.entries(rawMetadata).reduce<Record<string, string | number | boolean | null>>(
    (result, [key, value]) => {
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === null
      ) {
        result[key] = value;
      }

      return result;
    },
    {},
  );

  return additional;
}

function formatMediaType(type: string) {
  if (type === 'IMAGE') {
    return 'Photo';
  }

  if (type === 'VIDEO') {
    return 'Video';
  }

  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}