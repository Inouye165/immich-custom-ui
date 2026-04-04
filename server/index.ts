import { createApp } from './app';
import { getPort, getVectorConfig, getPaperlessConfig } from './config';
import { IndexingStateStore } from './vector/IndexingStateStore';
import { EmbeddingRateLimiter } from './vector/EmbeddingRateLimiter';
import { createEmbeddingService } from './vector/EmbeddingService';
import { DocumentIndexer } from './vector/DocumentIndexer';
import { BatchScheduler } from './vector/BatchScheduler';
import { getQdrantClient } from './vector/QdrantClientFactory';
import { createPaperlessGatewayFromConfig } from './paperless/PaperlessGateway';

const port = getPort();

async function main() {
  let indexingStateStore: IndexingStateStore | undefined;
  let batchScheduler: BatchScheduler | undefined;

  const vecConfig = getVectorConfig();
  const plConfig = getPaperlessConfig();

  if (vecConfig && plConfig) {
    indexingStateStore = new IndexingStateStore();
    await indexingStateStore.load();
    indexingStateStore.recoverInterruptedRecords();

    const plGw = createPaperlessGatewayFromConfig(plConfig);
    const qdrant = getQdrantClient(vecConfig);
    const rawEmbedding = createEmbeddingService(vecConfig);
    const rateLimiter = new EmbeddingRateLimiter(rawEmbedding, {
      requestsPerMinute: vecConfig.embedRequestsPerMinute,
      cooldownMinutes: vecConfig.embedCooldownMinutes,
      maxRetries: vecConfig.embedMaxRetries,
      backoffBaseMs: vecConfig.embedBackoffBaseMs,
      backoffMaxMs: vecConfig.embedBackoffMaxMs,
    });
    const indexer = new DocumentIndexer(plGw, qdrant, rateLimiter, vecConfig, indexingStateStore);
    batchScheduler = new BatchScheduler(indexer, indexingStateStore, {
      autoEnabled: vecConfig.autoIndexEnabled,
      intervalMinutes: vecConfig.autoIndexIntervalMinutes,
      batchSize: vecConfig.schedulerBatchSize,
    });
    batchScheduler.resumePendingRetry();
    batchScheduler.start();
  }

  const app = createApp({ indexingStateStore, batchScheduler });

  app.listen(port, () => {
    console.log(`Photo archive proxy listening on http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
