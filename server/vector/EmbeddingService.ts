import type { VectorConfig } from './VectorConfig';

export type EmbeddingPurpose = 'document' | 'query';

export interface EmbeddingService {
  embed(texts: string[], purpose?: EmbeddingPurpose): Promise<number[][]>;
  dimensions(): number | undefined;
}

interface EmbeddingApiResponse {
  data: { embedding: number[]; index: number }[];
  model: string;
  usage?: { prompt_tokens: number; total_tokens: number };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface GeminiBatchEmbedResponse {
  embeddings?: Array<{
    values?: number[];
  }>;
}

function normalizeProvider(provider: string): string {
  return provider.trim().toLowerCase();
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

function resolveOpenAICompatibleBaseUrl(config: VectorConfig): string {
  if (config.embeddingBaseUrl) {
    return stripTrailingSlash(config.embeddingBaseUrl);
  }

  return normalizeProvider(config.embeddingProvider) === 'ollama'
    ? 'http://localhost:11434/v1'
    : 'https://api.openai.com/v1';
}

/**
 * Calls any OpenAI-compatible /v1/embeddings endpoint.
 * Works with OpenAI, Ollama, vLLM, LiteLLM, and similar providers.
 */
export class OpenAICompatibleEmbeddingService implements EmbeddingService {
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;
  private detectedDimensions: number | undefined;

  constructor(config: VectorConfig, timeoutMs = 30_000) {
    this.model = config.embeddingModel;
    this.baseUrl = resolveOpenAICompatibleBaseUrl(config);
    this.apiKey = config.embeddingApiKey;
    this.timeoutMs = timeoutMs;
  }

  dimensions(): number | undefined {
    return this.detectedDimensions;
  }

  async embed(texts: string[], purpose: EmbeddingPurpose = 'document'): Promise<number[][]> {
    if (texts.length === 0) return [];
    void purpose;

    const url = `${this.baseUrl}/embeddings`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const maxRetries = 5;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ model: this.model, input: texts }),
          signal: controller.signal,
        });

        if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
          clearTimeout(timer);
          if (attempt < maxRetries) {
            const backoff = Math.min(2 ** attempt * 2000, 60_000);
            console.warn(`[embed] ${response.status} on attempt ${attempt + 1}, retrying in ${backoff}ms...`);
            await delay(backoff);
            continue;
          }
        }

        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          throw new Error(
            `Embedding request failed (${response.status}): ${detail.slice(0, 200)}`,
          );
        }

        const json = (await response.json()) as EmbeddingApiResponse;
        const sorted = json.data.sort((a, b) => a.index - b.index);
        const vectors = sorted.map((d) => d.embedding);

        if (vectors.length > 0 && vectors[0].length > 0) {
          this.detectedDimensions = vectors[0].length;
        }

        return vectors;
      } finally {
        clearTimeout(timer);
      }
    }

    throw new Error('Embedding request failed: max retries exceeded');
  }
}

export class GeminiEmbeddingService implements EmbeddingService {
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;
  private detectedDimensions: number | undefined;

  constructor(config: VectorConfig, timeoutMs = 30_000) {
    this.model = config.embeddingModel;
    this.baseUrl = stripTrailingSlash(
      config.embeddingBaseUrl ?? 'https://generativelanguage.googleapis.com/v1beta',
    );
    this.apiKey = config.embeddingApiKey ?? process.env.GEMINI_API_KEY;
    this.timeoutMs = timeoutMs;
  }

  dimensions(): number | undefined {
    return this.detectedDimensions;
  }

  async embed(texts: string[], purpose: EmbeddingPurpose = 'document'): Promise<number[][]> {
    if (texts.length === 0) return [];

    if (!this.apiKey) {
      throw new Error('Gemini embedding API key is not configured. Set DOCUMENT_EMBEDDING_API_KEY or GEMINI_API_KEY.');
    }

    const url = `${this.baseUrl}/models/${this.model}:batchEmbedContents?key=${encodeURIComponent(this.apiKey)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const taskType = this.model === 'gemini-embedding-001'
      ? (purpose === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT')
      : undefined;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: texts.map((text) => ({
            model: `models/${this.model}`,
            content: { parts: [{ text }] },
            ...(taskType ? { taskType } : {}),
          })),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(
          `Gemini embedding request failed (${response.status}): ${detail.slice(0, 200)}`,
        );
      }

      const json = (await response.json()) as GeminiBatchEmbedResponse;
      const vectors = (json.embeddings ?? []).map((entry) => entry.values ?? []);

      if (vectors.length === 0 || vectors.some((vector) => vector.length === 0)) {
        throw new Error('Gemini embedding response did not include usable vectors.');
      }

      this.detectedDimensions = vectors[0].length;
      return vectors;
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createEmbeddingService(config: VectorConfig): EmbeddingService {
  return normalizeProvider(config.embeddingProvider) === 'gemini'
    ? new GeminiEmbeddingService(config)
    : new OpenAICompatibleEmbeddingService(config);
}
