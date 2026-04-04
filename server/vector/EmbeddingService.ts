import type { VectorConfig } from './VectorConfig';

export interface EmbeddingService {
  embed(texts: string[]): Promise<number[][]>;
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
    this.baseUrl = config.embeddingBaseUrl ?? 'https://api.openai.com/v1';
    this.apiKey = config.embeddingApiKey;
    this.timeoutMs = timeoutMs;
  }

  dimensions(): number | undefined {
    return this.detectedDimensions;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

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
