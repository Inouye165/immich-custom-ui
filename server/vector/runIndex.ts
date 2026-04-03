import 'dotenv/config';
import { getPaperlessConfig, getVectorConfig } from '../config';
import { createPaperlessGatewayFromConfig } from '../paperless/PaperlessGateway';
import { OpenAICompatibleEmbeddingService } from './EmbeddingService';
import { getQdrantClient } from './QdrantClientFactory';
import { DocumentIndexer } from './DocumentIndexer';

async function main() {
  const paperlessConfig = getPaperlessConfig();
  if (!paperlessConfig) {
    console.error('[docs:index] Paperless is not configured. Set PAPERLESS_BASE_URL and PAPERLESS_API_TOKEN.');
    process.exit(1);
  }

  const vectorConfig = getVectorConfig();
  if (!vectorConfig) {
    console.error('[docs:index] Vector search is not enabled. Set DOCUMENT_VECTOR_ENABLED=true and configure QDRANT_URL, DOCUMENT_EMBEDDING_PROVIDER, DOCUMENT_EMBEDDING_MODEL.');
    process.exit(1);
  }

  console.log('[docs:index] Starting incremental document index...');
  console.log(`  Collection : ${vectorConfig.collection}`);
  console.log(`  Model      : ${vectorConfig.embeddingModel}`);
  console.log(`  Schema     : ${vectorConfig.schemaVersion}`);
  console.log(`  Chunk size : ${vectorConfig.indexChunkSize} (overlap: ${vectorConfig.indexChunkOverlap})`);
  console.log(`  Batch size : ${vectorConfig.indexBatchSize}`);

  const gateway = createPaperlessGatewayFromConfig(paperlessConfig);
  const qdrant = getQdrantClient(vectorConfig);
  const embedding = new OpenAICompatibleEmbeddingService(vectorConfig);

  const indexer = new DocumentIndexer(gateway, qdrant, embedding, vectorConfig);
  const report = await indexer.runFullIndex();

  console.log('\n[docs:index] Indexing complete.');
  console.log(`  Scanned : ${report.scanned}`);
  console.log(`  Indexed : ${report.indexed}`);
  console.log(`  Updated : ${report.updated}`);
  console.log(`  Skipped : ${report.skipped}`);
  console.log(`  Deleted : ${report.deleted}`);
  console.log(`  Failed  : ${report.failed}`);
  console.log(`  Duration: ${(report.durationMs / 1000).toFixed(1)}s`);

  if (report.failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[docs:index] Fatal error:', err);
  process.exit(1);
});
