export type DataSourceState =
  | 'disabled'
  | 'disk-cache'
  | 'fallback'
  | 'live'
  | 'memory-cache'
  | 'unavailable';

export interface AssetPoint {
  latitude: number;
  longitude: number;
}

export interface AssetMapConfig {
  zoom: number;
  center: AssetPoint;
}

export interface NearbyPoi {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
}

export interface AssetWeather {
  temperatureC: number | null;
  temperatureF: number | null;
  apparentTemperatureC: number | null;
  apparentTemperatureF: number | null;
  weatherCode: number | null;
  weatherLabel: string | null;
  observedAt: string | null;
  isApproximate: boolean;
  source: string;
  summary: string | null;
}

export interface AssetDetails {
  id: string;
  title: string;
  mediaType: string;
  imageUrl: string;
  videoUrl: string | null;
  thumbnailUrl: string;
  mimeType: string | null;
  takenAt: string | null;
  createdAt: string;
  width: number | null;
  height: number | null;
  locationLabel: string | null;
}

export interface AssetMetadata {
  dateTimeOriginal: string | null;
  localDateTime: string | null;
  fileCreatedAt: string | null;
  fileModifiedAt: string | null;
  cameraMake: string | null;
  cameraModel: string | null;
  lensModel: string | null;
  width: number | null;
  height: number | null;
  fileType: string | null;
  fileSizeBytes: number | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  timeZone: string | null;
  exposureTime: string | null;
  fNumber: number | null;
  focalLength: number | null;
  iso: number | null;
  description: string | null;
  additional: Record<string, string | number | boolean | null>;
}

export interface AssetContextResponse {
  asset: AssetDetails;
  metadata: AssetMetadata;
  gps: AssetPoint | null;
  map: AssetMapConfig | null;
  pois: NearbyPoi[];
  weather: AssetWeather | null;
  aiSummary: string | null;
  aiSummaryAvailable: boolean;
  status: {
    aiSummary: DataSourceState;
    pois: DataSourceState;
    weather: DataSourceState;
  };
  warnings: string[];
}