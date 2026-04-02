import type { NearbyPoi } from '../../src/types';
import type { ServerConfig } from '../config';
import type { CacheLookupResult } from './PersistentCache';
import { PersistentCache } from './PersistentCache';
import { fetchJsonWithTimeout } from './requestUtils';

const POI_CACHE_TTL_MS = 15 * 60 * 1000;
const POI_TIMEOUT_MS = 3500;
const MAX_POIS = 10;
const DEFAULT_OVERPASS_BASE_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const NOISY_CATEGORIES = new Set([
  'atm',
  'bench',
  'bicycle_parking',
  'charging_station',
  'clock',
  'parking',
  'parking_entrance',
  'post_box',
  'recycling',
  'toilets',
  'vending_machine',
  'waste_basket',
]);

interface PoiLookupInput {
  latitude: number;
  longitude: number;
}

interface OverpassResponse {
  elements?: Array<{
    center?: { lat?: number; lon?: number };
    id: number;
    lat?: number;
    lon?: number;
    tags?: Record<string, string>;
    type: string;
  }>;
}

export interface PoiService {
  getNearbyPois(input: PoiLookupInput): Promise<CacheLookupResult<NearbyPoi[]>>;
}

export class LivePoiService implements PoiService {
  private readonly cache = new PersistentCache<NearbyPoi[]>('nearby-pois', POI_CACHE_TTL_MS);

  private readonly config: Pick<ServerConfig, 'mapPoiRadiusMeters' | 'overpassBaseUrl'>;

  constructor(config: Pick<ServerConfig, 'mapPoiRadiusMeters' | 'overpassBaseUrl'>) {
    this.config = config;
  }

  async getNearbyPois(input: PoiLookupInput): Promise<CacheLookupResult<NearbyPoi[]>> {
    const cacheKey = [
      input.latitude.toFixed(4),
      input.longitude.toFixed(4),
      this.config.mapPoiRadiusMeters,
    ].join(':');

    return this.cache.getOrCreate(cacheKey, async () => this.fetchNearbyPois(input));
  }

  private async fetchNearbyPois(input: PoiLookupInput) {
    const query = buildOverpassQuery(
      input.latitude,
      input.longitude,
      this.config.mapPoiRadiusMeters,
    );

    let lastError: unknown;
    for (const endpoint of getOverpassEndpoints(this.config.overpassBaseUrl)) {
      try {
        const payload = await fetchJsonWithTimeout<OverpassResponse>(endpoint, {
          body: query,
          headers: {
            'content-type': 'text/plain;charset=UTF-8',
          },
          method: 'POST',
          operation: 'Nearby POI lookup',
          timeoutMs: POI_TIMEOUT_MS,
        });

        return (payload.elements ?? [])
          .map((element) => normalizePoiElement(element, input.latitude, input.longitude))
          .filter((element): element is NearbyPoi => element !== null)
          .sort((left, right) => left.distanceMeters - right.distanceMeters)
          .slice(0, MAX_POIS);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error('Nearby POI lookup failed.');
  }
}

export function createLivePoiService(
  config: Pick<ServerConfig, 'mapPoiRadiusMeters' | 'overpassBaseUrl'>,
): PoiService {
  return new LivePoiService(config);
}

function getOverpassEndpoints(primaryEndpoint: string) {
  return Array.from(new Set([primaryEndpoint, ...DEFAULT_OVERPASS_BASE_URLS]));
}

function buildOverpassQuery(latitude: number, longitude: number, radius: number) {
  const around = `(around:${radius},${latitude},${longitude})`;
  return `
[out:json][timeout:15];
(
  node${around}[name][tourism];
  way${around}[name][tourism];
  relation${around}[name][tourism];
  node${around}[name][historic];
  way${around}[name][historic];
  relation${around}[name][historic];
  node${around}[name][leisure];
  way${around}[name][leisure];
  relation${around}[name][leisure];
  node${around}[name][amenity];
  way${around}[name][amenity];
  relation${around}[name][amenity];
  node${around}[name][shop];
  way${around}[name][shop];
  relation${around}[name][shop];
  node${around}[name][natural];
  way${around}[name][natural];
  relation${around}[name][natural];
);
out center tags;
`.trim();
}

function normalizePoiElement(
  element: NonNullable<OverpassResponse['elements']>[number],
  latitude: number,
  longitude: number,
) {
  const point = getPoiCoordinates(element);
  const name = element.tags?.name?.trim();
  const category = getPoiCategory(element.tags);
  if (!point || !name || !category) {
    return null;
  }

  return {
    id: `${element.type}-${element.id}`,
    name,
    category,
    latitude: point.latitude,
    longitude: point.longitude,
    distanceMeters: Math.round(haversineDistanceMeters(latitude, longitude, point.latitude, point.longitude)),
  } satisfies NearbyPoi;
}

function getPoiCoordinates(
  element: NonNullable<OverpassResponse['elements']>[number],
) {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return null;
  }

  return { latitude, longitude };
}

function getPoiCategory(tags?: Record<string, string>) {
  if (!tags) {
    return null;
  }

  const keys: Array<keyof typeof tags> = ['tourism', 'historic', 'leisure', 'amenity', 'shop', 'natural'];
  for (const key of keys) {
    const value = tags[key];
    if (!value || NOISY_CATEGORIES.has(value)) {
      continue;
    }

    return value
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  return null;
}

function haversineDistanceMeters(
  startLatitude: number,
  startLongitude: number,
  endLatitude: number,
  endLongitude: number,
) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const deltaLatitude = toRadians(endLatitude - startLatitude);
  const deltaLongitude = toRadians(endLongitude - startLongitude);
  const latitude1 = toRadians(startLatitude);
  const latitude2 = toRadians(endLatitude);

  const a =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.sin(deltaLongitude / 2) *
      Math.sin(deltaLongitude / 2) *
      Math.cos(latitude1) *
      Math.cos(latitude2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}