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
  let poiStatus: AssetContextResponse['status']['pois'] = 'unavailable';
  let weatherStatus: AssetContextResponse['status']['weather'] = 'unavailable';

  if (gps) {
    try {
      const poiResult = await options.poiService.getNearbyPois(gps);
      pois = poiResult.value;
      poiStatus = poiResult.source;
    } catch {
      poiStatus = 'fallback';
      warnings.push('Nearby points of interest are unavailable right now.');
    }

    const timestamp = normalizeAssetTimestamp(options.assetInfo);
    if (timestamp) {
      try {
        const weatherResult = await options.weatherService.getHistoricalWeather({
          latitude: gps.latitude,
          longitude: gps.longitude,
          timestamp,
        });
        weather = weatherResult.value;
        weatherStatus = weatherResult.source;
      } catch {
        weatherStatus = 'fallback';
        warnings.push('Historical weather is unavailable right now.');
      }
    }
  }

  let aiSummary = null;
  let aiSummaryStatus: AssetContextResponse['status']['aiSummary'] = options.aiSummaryService.isEnabled()
    ? 'unavailable'
    : 'disabled';
  if (options.includeAiSummary && options.aiSummaryService.isEnabled()) {
    try {
      const aiSummaryResult = await options.aiSummaryService.summarizePhotoContext({
        asset,
        metadata,
        gps,
        pois,
        weather,
      });
      aiSummary = aiSummaryResult.value;
      aiSummaryStatus = aiSummaryResult.source;
    } catch {
      aiSummaryStatus = 'fallback';
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
    status: {
      aiSummary: aiSummaryStatus,
      pois: poiStatus,
      weather: weatherStatus,
    },
    warnings,
  };
}