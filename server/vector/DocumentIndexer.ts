import { createHash } from 'node:crypto';
import type { QdrantClient } from '@qdrant/js-client-rest';
import type { PaperlessGateway } from '../paperless/PaperlessGateway';
import type { PaperlessDocument } from '../paperless/paperlessTypes';
import type { EmbeddingService } from './EmbeddingService';
import type { VectorConfig } from './VectorConfig';
import type { IndexingStateStore } from './IndexingStateStore';
import { chunkText } from './DocumentChunker';
import { computeFingerprint } from './DocumentFingerprint';

export interface IndexReport {
  scanned: number;
  indexed: number;
  skipped: number;
  updated: number;
  deleted: number;
  failed: number;
  durationMs: number;
}

interface PointPayload {
  documentId: number;
  chunkIndex: number;
  documentTitle: string;
  fingerprint: string;
  embeddingModel: string;
  schemaVersion: string;
  indexedAt: string;
  sourceCreatedAt: string;
  sourceUpdatedAt: string;
  correspondent: number | null;
  documentType: number | null;
  tags: number[];
  chunkText: string;
}

/** Builds a deterministic point ID from document ID, chunk index, and schema version. */
function buildPointId(docId: number, chunkIndex: number, schemaVersion: string): string {
  return createHash('md5')
    .update(`${schemaVersion}:${docId}:${chunkIndex}`)
    .digest('hex')
    .slice(0, 32);
}

export class DocumentIndexer {
  private readonly gateway: PaperlessGateway;
  private readonly qdrant: QdrantClient;
  private readonly embedding: EmbeddingService;
  private readonly config: VectorConfig;
  private readonly stateStore: IndexingStateStore | null;
  private docCache = new Map<number, PaperlessDocument>();

  constructor(
    gateway: PaperlessGateway,
    qdrant: QdrantClient,
    embedding: EmbeddingService,
    config: VectorConfig,
    stateStore?: IndexingStateStore,
  ) {
    this.gateway = gateway;
    this.qdrant = qdrant;
    this.embedding = embedding;
    this.config = config;
    this.stateStore = stateStore ?? null;
  }

  /**
   * Scan Paperless and update the state store with pending/indexed status.
   * Does not embed anything — just bookkeeping.
   */
  async scanAndSyncState(): Promise<void> {
    if (!this.stateStore) return;

    await this.ensureCollection();
    const existingFingerprints = await this.loadExistingFingerprints();
    const seenDocIds = new Set<number>();

    let page = 1;
    let hasMore = true;
    while (hasMore) {
      let response;
      try {
        response = await this.gateway.listDocuments(page);
      } catch {
        break;
      }

      for (const doc of response.results) {
        seenDocIds.add(doc.id);
        this.docCache.set(doc.id, doc);

        const content = doc.content?.trim() ?? '';
        const textForIndexing = content.length > 20
          ? content
          : [doc.title, content, doc.created].filter(Boolean).join(' — ');

        const fingerprint = computeFingerprint({
          id: doc.id,
          title: doc.title,
          content: textForIndexing,
          created: doc.created,
          modified: doc.modified,
        });

        const existingFp = existingFingerprints.get(doc.id);
        const currentRecord = this.stateStore.getRecord(doc.id);

        if (existingFp === fingerprint) {
          // Already indexed with matching fingerprint
          if (!currentRecord || currentRecord.status !== 'indexed') {
            this.stateStore.upsertRecord({
              documentId: doc.id,
              title: doc.title,
              fingerprint,
              status: 'indexed',
              retryCount: 0,
              lastAttemptAt: null,
              lastSuccessAt: new Date().toISOString(),
              lastError: null,
              nextRetryAt: null,
            });
          }
        } else if (!currentRecord || currentRecord.fingerprint !== fingerprint ||
                   currentRecord.status === 'indexed') {
          // New or changed document — mark pending
          this.stateStore.markPending(doc.id, doc.title, fingerprint);
        }
        // If already pending/failed/rate-limited with same fingerprint, leave it alone
      }

      hasMore = response.next !== null;
      page++;
    }

    // Remove state records for documents no longer in Paperless
    for (const record of this.stateStore.getAllRecords()) {
      if (!seenDocIds.has(record.documentId)) {
        this.stateStore.removeRecord(record.documentId);
        try {
          await this.deleteDocumentPoints(record.documentId);
        } catch {
          // Orphan cleanup is best-effort
        }
      }
    }
  }

  /** Index a single document by ID. Used by the batch scheduler. */
  async indexSingleDocument(docId: number): Promise<void> {
    await this.ensureCollection();

    let doc = this.docCache.get(docId);
    if (!doc) {
      // Fetch the specific page; Paperless doesn't have a get-by-id, scan until found
      let page = 1;
      let found = false;
      while (!found) {
        const response = await this.gateway.listDocuments(page);
        for (const d of response.results) {
          this.docCache.set(d.id, d);
          if (d.id === docId) {
            doc = d;
            found = true;
          }
        }
        if (response.next === null) break;
        page++;
      }
    }

    if (!doc) {
      throw new Error(`Document ${docId} not found in Paperless.`);
    }

    const existingFingerprints = await this.loadExistingFingerprints();
    const report: IndexReport = {
      scanned: 1, indexed: 0, skipped: 0, updated: 0, deleted: 0, failed: 0, durationMs: 0,
    };

    await this.processDocument(doc, existingFingerprints, report);

    if (report.failed > 0) {
      throw new Error(`Indexing failed for document ${docId}`);
    }
  }

  /** Full index run (used by CLI). */
  async runFullIndex(): Promise<IndexReport> {
    const start = Date.now();
    const report: IndexReport = {
      scanned: 0, indexed: 0, skipped: 0, updated: 0, deleted: 0, failed: 0, durationMs: 0,
    };

    await this.ensureCollection();
    const existingFingerprints = await this.loadExistingFingerprints();
    const seenDocIds = new Set<number>();

    let page = 1;
    let hasMore = true;

    while (hasMore) {
      let response;
      try {
        response = await this.gateway.listDocuments(page);
      } catch (err) {
        console.error(`[indexer] Failed to fetch page ${page}:`, err);
        report.failed++;
        break;
      }

      for (let i = 0; i < response.results.length; i++) {
        const doc = response.results[i];
        report.scanned++;
        seenDocIds.add(doc.id);

        try {
          await this.processDocument(doc, existingFingerprints, report);
        } catch (err) {
          console.error(`[indexer] Failed to process document ${doc.id}:`, err);
          report.failed++;
        }

        if (i < response.results.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      hasMore = response.next !== null;
      page++;
    }

    const orphanedIds = [...existingFingerprints.keys()].filter(
      (docId) => !seenDocIds.has(docId),
    );
    for (const docId of orphanedIds) {
      try {
        await this.deleteDocumentPoints(docId);
        report.deleted++;
      } catch (err) {
        console.error(`[indexer] Failed to delete orphaned chunks for document ${docId}:`, err);
        report.failed++;
      }
    }

    report.durationMs = Date.now() - start;
    return report;
  }

  private async ensureCollection(): Promise<void> {
    const collections = await this.qdrant.getCollections();
    const exists = collections.collections.some(
      (c) => c.name === this.config.collection,
    );
    if (exists) return;

    const testVectors = await this.embedding.embed(['test']);
    const dimensions = testVectors[0]?.length;
    if (!dimensions) {
      throw new Error('Could not detect embedding dimensions.');
    }

    await this.qdrant.createCollection(this.config.collection, {
      vectors: { size: dimensions, distance: 'Cosine' },
    });
    console.log(`[indexer] Created collection "${this.config.collection}" with ${dimensions} dimensions.`);
  }

  private async loadExistingFingerprints(): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    let offset: string | number | undefined = undefined;
    const limit = 100;

    while (true) {
      const result = await this.qdrant.scroll(this.config.collection, {
        limit,
        offset,
        with_payload: ['documentId', 'fingerprint', 'chunkIndex'],
        with_vector: false,
      });

      for (const point of result.points) {
        const payload = point.payload as Partial<PointPayload> | null;
        if (payload?.documentId != null && payload.fingerprint && payload.chunkIndex === 0) {
          map.set(payload.documentId, payload.fingerprint);
        }
      }

      if (!result.next_page_offset) break;
      offset = result.next_page_offset as string | number;
    }

    return map;
  }

  private async processDocument(
    doc: PaperlessDocument,
    existingFingerprints: Map<number, string>,
    report: IndexReport,
  ): Promise<void> {
    const content = doc.content?.trim() ?? '';
    const textForIndexing = content.length > 20
      ? content
      : [doc.title, content, doc.created].filter(Boolean).join(' — ');

    const fingerprint = computeFingerprint({
      id: doc.id,
      title: doc.title,
      content: textForIndexing,
      created: doc.created,
      modified: doc.modified,
    });

    const existingFp = existingFingerprints.get(doc.id);
    if (existingFp === fingerprint) {
      report.skipped++;
      return;
    }

    const isUpdate = existingFp !== undefined;

    if (isUpdate) {
      await this.deleteDocumentPoints(doc.id);
    }

    const chunks = chunkText(
      textForIndexing,
      this.config.indexChunkSize,
      this.config.indexChunkOverlap,
    );

    if (chunks.length === 0) {
      report.skipped++;
      return;
    }

    const vectors = await this.embedInBatches(chunks.map((c) => c.text));

    const now = new Date().toISOString();
    const points = chunks.map((chunk, i) => ({
      id: buildPointId(doc.id, chunk.index, this.config.schemaVersion),
      vector: vectors[i],
      payload: {
        documentId: doc.id,
        chunkIndex: chunk.index,
        documentTitle: doc.title,
        fingerprint,
        embeddingModel: this.config.embeddingModel,
        schemaVersion: this.config.schemaVersion,
        indexedAt: now,
        sourceCreatedAt: doc.created,
        sourceUpdatedAt: doc.modified ?? doc.added,
        correspondent: doc.correspondent,
        documentType: doc.document_type,
        tags: doc.tags ?? [],
        chunkText: chunk.text.slice(0, 500),
      } satisfies PointPayload,
    }));

    await this.qdrant.upsert(this.config.collection, { points });

    if (isUpdate) {
      report.updated++;
    } else {
      report.indexed++;
    }
  }

  private async embedInBatches(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += this.config.indexBatchSize) {
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      const batch = texts.slice(i, i + this.config.indexBatchSize);
      const vectors = await this.embedding.embed(batch);
      results.push(...vectors);
    }
    return results;
  }

  private async deleteDocumentPoints(docId: number): Promise<void> {
    await this.qdrant.delete(this.config.collection, {
      filter: {
        must: [{ key: 'documentId', match: { value: docId } }],
      },
    });
  }
}
