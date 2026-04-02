import type { AssetWeather } from '../../src/types';
import type { ServerConfig } from '../config';
import type { NormalizedAssetTimestamp } from '../assets/normalizeAssetTimestamp';
import { formatInstantInTimeZone } from '../assets/normalizeAssetTimestamp';
import type { CacheLookupResult } from './PersistentCache';
import { PersistentCache } from './PersistentCache';
import { fetchJsonWithTimeout } from './requestUtils';

const WEATHER_TIMEOUT_MS = 3000;
const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000;

interface WeatherLookupInput {
  latitude: number;
  longitude: number;
  timestamp: NormalizedAssetTimestamp;
}

interface OpenMeteoArchiveResponse {
  timezone?: string;
  hourly?: {
    apparent_temperature?: Array<number | null>;
    temperature_2m?: Array<number | null>;
    time?: string[];
    weather_code?: Array<number | null>;
  };
  daily?: {
    temperature_2m_max?: Array<number | null>;
    temperature_2m_min?: Array<number | null>;
    time?: string[];
    weather_code?: Array<number | null>;
  };
}

export interface WeatherService {
  getHistoricalWeather(input: WeatherLookupInput): Promise<CacheLookupResult<AssetWeather | null>>;
}

export class LiveWeatherService implements WeatherService {
  private readonly cache = new PersistentCache<AssetWeather | null>('weather-history', WEATHER_CACHE_TTL_MS);

  private readonly config: Pick<ServerConfig, 'weatherBaseUrl'>;

  constructor(config: Pick<ServerConfig, 'weatherBaseUrl'>) {
    this.config = config;
  }

  async getHistoricalWeather(
    input: WeatherLookupInput,
  ): Promise<CacheLookupResult<AssetWeather | null>> {
    const cacheKey = [
      input.latitude.toFixed(3),
      input.longitude.toFixed(3),
      input.timestamp.localDate ?? input.timestamp.exactInstant ?? 'unknown',
    ].join(':');

    return this.cache.getOrCreate(cacheKey, async () => this.fetchHistoricalWeather(input));
  }

  private async fetchHistoricalWeather(input: WeatherLookupInput) {
    const anchorDate = input.timestamp.localDate;
    if (!anchorDate) {
      return null;
    }

    const url = new URL(this.config.weatherBaseUrl);
    const { startDate, endDate } = buildDateWindow(anchorDate);
    url.searchParams.set('latitude', String(input.latitude));
    url.searchParams.set('longitude', String(input.longitude));
    url.searchParams.set('start_date', startDate);
    url.searchParams.set('end_date', endDate);
    url.searchParams.set('hourly', 'temperature_2m,apparent_temperature,weather_code');
    url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,weather_code');
    url.searchParams.set('timezone', 'auto');

    const payload = await fetchJsonWithTimeout<OpenMeteoArchiveResponse>(url, {
      operation: 'Weather lookup',
      timeoutMs: WEATHER_TIMEOUT_MS,
    });

    return normalizeWeatherResponse(payload, input.timestamp);
  }
}

export function createLiveWeatherService(
  config: Pick<ServerConfig, 'weatherBaseUrl'>,
): WeatherService {
  return new LiveWeatherService(config);
}

function normalizeWeatherResponse(
  payload: OpenMeteoArchiveResponse,
  timestamp: NormalizedAssetTimestamp,
) {
  const target = buildTargetClock(timestamp, payload.timezone);
  const hourly = payload.hourly;
  if (hourly?.time?.length && target?.date && target.hour !== null) {
    const candidate = selectClosestHourly(payload, target.date, target.hour, target.minute ?? 0);
    if (candidate) {
      return {
        temperatureC: candidate.temperatureC,
        temperatureF: toFahrenheit(candidate.temperatureC),
        apparentTemperatureC: candidate.apparentTemperatureC,
        apparentTemperatureF: toFahrenheit(candidate.apparentTemperatureC),
        weatherCode: candidate.weatherCode,
        weatherLabel: getWeatherLabel(candidate.weatherCode),
        observedAt: candidate.observedAt,
        isApproximate: false,
        source: 'open-meteo',
        summary: null,
      } satisfies AssetWeather;
    }
  }

  return selectDailyFallback(payload, target?.date ?? timestamp.localDate);
}

function buildTargetClock(timestamp: NormalizedAssetTimestamp, timeZone?: string) {
  if (timestamp.exactInstant && timeZone) {
    const zoned = formatInstantInTimeZone(timestamp.exactInstant, timeZone);
    if (zoned) {
      return zoned;
    }
  }

  return {
    date: timestamp.localDate,
    hour: timestamp.localHour,
    minute: timestamp.localMinute,
  };
}

function selectClosestHourly(
  payload: OpenMeteoArchiveResponse,
  targetDate: string,
  targetHour: number,
  targetMinute: number,
) {
  const times = payload.hourly?.time ?? [];
  const temperatures = payload.hourly?.temperature_2m ?? [];
  const apparentTemperatures = payload.hourly?.apparent_temperature ?? [];
  const weatherCodes = payload.hourly?.weather_code ?? [];

  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const [index, time] of times.entries()) {
    const match = time.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
    if (!match || match[1] !== targetDate) {
      continue;
    }

    const hour = Number(match[2]);
    const minute = Number(match[3]);
    const distance = Math.abs((hour - targetHour) * 60 + (minute - targetMinute));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  if (bestIndex === -1) {
    return null;
  }

  return {
    temperatureC: temperatures[bestIndex] ?? null,
    apparentTemperatureC: apparentTemperatures[bestIndex] ?? null,
    weatherCode: weatherCodes[bestIndex] ?? null,
    observedAt: `${times[bestIndex]}:00`,
  };
}

function selectDailyFallback(payload: OpenMeteoArchiveResponse, targetDate: string | null) {
  const daily = payload.daily;
  if (!daily?.time?.length || !targetDate) {
    return null;
  }

  const index = daily.time.findIndex((time) => time === targetDate);
  if (index === -1) {
    return null;
  }

  const max = daily.temperature_2m_max?.[index] ?? null;
  const min = daily.temperature_2m_min?.[index] ?? null;
  const average = max !== null && min !== null ? roundToSingleDecimal((max + min) / 2) : max ?? min;
  const range =
    max !== null && min !== null
      ? `Approximate daytime range ${roundToSingleDecimal(min)}C to ${roundToSingleDecimal(max)}C.`
      : 'Approximate daytime weather summary.';

  return {
    temperatureC: average,
    temperatureF: toFahrenheit(average),
    apparentTemperatureC: null,
    apparentTemperatureF: null,
    weatherCode: daily.weather_code?.[index] ?? null,
    weatherLabel: getWeatherLabel(daily.weather_code?.[index] ?? null),
    observedAt: `${daily.time[index]}T12:00:00`,
    isApproximate: true,
    source: 'open-meteo',
    summary: range,
  } satisfies AssetWeather;
}

function buildDateWindow(dateString: string) {
  const base = new Date(`${dateString}T00:00:00.000Z`);
  return {
    startDate: shiftUtcDate(base, -1),
    endDate: shiftUtcDate(base, 1),
  };
}

function shiftUtcDate(date: Date, offsetDays: number) {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + offsetDays);
  return value.toISOString().slice(0, 10);
}

function toFahrenheit(value: number | null) {
  if (value === null) {
    return null;
  }

  return roundToSingleDecimal((value * 9) / 5 + 32);
}

function roundToSingleDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function getWeatherLabel(code: number | null) {
  if (code === null) {
    return null;
  }

  const labels: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mostly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with hail',
    99: 'Severe thunderstorm with hail',
  };

  return labels[code] ?? 'Weather unavailable';
}