import type { AssetContextResponse } from '../../src/types';
import { extractGps, normalizeAssetInfo, normalizeAssetMetadata } from './normalizeAssetDetails';
import { normalizeAssetTimestamp } from './normalizeAssetTimestamp';
import type { ImmichAssetInfo, ImmichAssetMetadata } from '../immich/immichTypes';
import type { AiSummaryService } from '../services/GeminiService';
import type { PoiService } from '../services/PoiService';
import type { WeatherService } from '../services/WeatherService';

interface BuildAssetContextOptions {
  aiSummaryService: AiSummaryService;
  assetInfo: ImmichAssetInfo;
  includeAiSummary: boolean;
  mapDefaultZoom: number;
  poiService: PoiService;
  rawMetadata: ImmichAssetMetadata | null;
  weatherService: WeatherService;
  warnings?: string[];
}

export async function buildAssetContext(
  options: BuildAssetContextOptions,
): Promise<AssetContextResponse> {
  const asset = normalizeAssetInfo(options.assetInfo);
  const metadata = normalizeAssetMetadata(options.assetInfo, options.rawMetadata);
  const gps = extractGps(options.assetInfo.exifInfo);
  const warnings = [...(options.warnings ?? [])];

  let pois = [] as AssetContextResponse['pois'];
  let weather = null as AssetContextResponse['weather'];

  if (gps) {
    try {
      pois = await options.poiService.getNearbyPois(gps);
    } catch {
      warnings.push('Nearby points of interest are unavailable right now.');
    }

    const timestamp = normalizeAssetTimestamp(options.assetInfo);
    if (timestamp) {
      try {
        weather = await options.weatherService.getHistoricalWeather({
          latitude: gps.latitude,
          longitude: gps.longitude,
          timestamp,
        });
      } catch {
        warnings.push('Historical weather is unavailable right now.');
      }
    }
  }

  let aiSummary = null;
  if (options.includeAiSummary && options.aiSummaryService.isEnabled()) {
    try {
      aiSummary = await options.aiSummaryService.summarizePhotoContext({
        asset,
        metadata,
        gps,
        pois,
        weather,
      });
    } catch {
      warnings.push('AI summary is unavailable right now.');
    }
  }

  return {
    asset,
    metadata,
    gps,
    map: gps
      ? {
          zoom: options.mapDefaultZoom,
          center: gps,
        }
      : null,
    pois,
    weather,
    aiSummary,
    aiSummaryAvailable: options.aiSummaryService.isEnabled(),
    warnings,
  };
}