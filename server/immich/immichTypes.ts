export interface ImmichExifInfo {
  city?: string | null;
  country?: string | null;
  dateTimeOriginal?: string | null;
  description?: string | null;
  exifImageHeight?: number | null;
  exifImageWidth?: number | null;
  exposureTime?: string | null;
  fNumber?: number | null;
  fileSizeInByte?: number | null;
  focalLength?: number | null;
  iso?: number | null;
  latitude?: number | null;
  lensModel?: string | null;
  longitude?: number | null;
  make?: string | null;
  model?: string | null;
  orientation?: string | null;
  state?: string | null;
  timeZone?: string | null;
}

export interface ImmichAsset {
  id: string;
  createdAt: string;
  fileCreatedAt: string;
  localDateTime: string;
  originalFileName: string;
  originalMimeType?: string;
  thumbhash?: string | null;
  type: string;
  exifInfo?: ImmichExifInfo | null;
}

export interface ImmichAssetInfo extends ImmichAsset {
  duration?: string;
  fileModifiedAt?: string;
  hasMetadata?: boolean;
  height?: number | null;
  isArchived?: boolean;
  isFavorite?: boolean;
  isOffline?: boolean;
  isTrashed?: boolean;
  updatedAt?: string;
  width?: number | null;
}

export type ImmichAssetMetadata = Record<string, unknown>;

export interface ImmichSearchAssetPage {
  items: ImmichAsset[];
  total: number;
  count: number;
  nextPage: string | null;
}

export interface ImmichSearchResponse {
  assets: ImmichSearchAssetPage;
  albums: unknown;
}

export interface ImmichSmartSearchPayload {
  query: string;
  page: number;
  size: number;
  takenAfter?: string;
  takenBefore?: string;
}

export type ThumbnailSize = 'thumbnail' | 'preview' | 'fullsize' | 'original';
