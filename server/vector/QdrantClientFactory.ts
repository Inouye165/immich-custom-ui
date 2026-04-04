import { QdrantClient } from '@qdrant/js-client-rest';
import type { VectorConfig } from './VectorConfig';

let cachedClient: QdrantClient | null = null;
let cachedUrl: string | null = null;

/** Returns a singleton QdrantClient for the given config. */
export function getQdrantClient(config: VectorConfig): QdrantClient {
  if (cachedClient && cachedUrl === config.qdrantUrl) {
    return cachedClient;
  }

  cachedClient = new QdrantClient({
    url: config.qdrantUrl,
    apiKey: config.qdrantApiKey,
    timeout: 60_000,
  });
  cachedUrl = config.qdrantUrl;
  return cachedClient;
}

/** Reset cached client — useful for tests. */
export function resetQdrantClient(): void {
  cachedClient = null;
  cachedUrl = null;
}
