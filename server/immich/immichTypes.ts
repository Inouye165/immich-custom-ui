export interface ImmichAsset {
  id: string;
  createdAt: string;
  fileCreatedAt: string;
  localDateTime: string;
  originalFileName: string;
  originalMimeType?: string;
  thumbhash?: string | null;
  type: string;
  exifInfo?: {
    city?: string | null;
    country?: string | null;
    state?: string | null;
  } | null;
}

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
