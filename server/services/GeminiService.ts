import type {
  AssetDetails,
  AssetMetadata,
  AssetPoint,
  AssetWeather,
  NearbyPoi,
} from '../../src/types';
import type { ServerConfig } from '../config';
import { fetchJsonWithTimeout } from './requestUtils';

const GEMINI_TIMEOUT_MS = 7000;

interface GeminiSummaryInput {
  asset: AssetDetails;
  metadata: AssetMetadata;
  gps: AssetPoint | null;
  pois: NearbyPoi[];
  weather: AssetWeather | null;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

export interface AiSummaryService {
  isEnabled(): boolean;
  summarizePhotoContext(input: GeminiSummaryInput): Promise<string | null>;
}

export class DisabledAiSummaryService implements AiSummaryService {
  isEnabled() {
    return false;
  }

  async summarizePhotoContext(): Promise<string | null> {
    return null;
  }
}

export class LiveGeminiSummaryService implements AiSummaryService {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  isEnabled() {
    return true;
  }

  async summarizePhotoContext(input: GeminiSummaryInput): Promise<string | null> {
    const payload = await fetchJsonWithTimeout<GeminiResponse>(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(this.apiKey)}`,
      {
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: buildPrompt(input),
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 160,
            temperature: 0.2,
          },
        }),
        headers: {
          'content-type': 'application/json',
        },
        method: 'POST',
        operation: 'Gemini summary generation',
        timeoutMs: GEMINI_TIMEOUT_MS,
      },
    );

    const summary = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text?.trim() ?? '')
      .join(' ')
      .trim();

    return summary || null;
  }
}

export function createLiveAiSummaryService(
  config: Pick<ServerConfig, 'geminiApiKey'>,
): AiSummaryService {
  if (!config.geminiApiKey) {
    return new DisabledAiSummaryService();
  }

  return new LiveGeminiSummaryService(config.geminiApiKey);
}

function buildPrompt(input: GeminiSummaryInput) {
  return [
    'Write a grounded 2-4 sentence summary about this photo context.',
    'Use only the supplied metadata, GPS context, nearby POIs, and weather.',
    'Do not infer image contents, people, emotions, or activities unless explicitly present in the input.',
    'If a fact is missing, omit it.',
    `Photo title: ${input.asset.title}`,
    `Taken at: ${input.asset.takenAt ?? 'unknown'}`,
    `Media type: ${input.asset.mediaType}`,
    `Location label: ${input.asset.locationLabel ?? 'unknown'}`,
    `GPS: ${input.gps ? `${input.gps.latitude}, ${input.gps.longitude}` : 'unavailable'}`,
    `Camera make: ${input.metadata.cameraMake ?? 'unknown'}`,
    `Camera model: ${input.metadata.cameraModel ?? 'unknown'}`,
    `Lens: ${input.metadata.lensModel ?? 'unknown'}`,
    `POIs: ${
      input.pois.length > 0
        ? input.pois.map((poi) => `${poi.name} (${poi.category}, ${poi.distanceMeters}m)`).join('; ')
        : 'none'
    }`,
    `Weather: ${
      input.weather
        ? `${input.weather.weatherLabel ?? 'unknown'}, ${input.weather.temperatureC ?? 'unknown'}C`
        : 'unavailable'
    }`,
  ].join('\n');
}