import type { PaperlessGateway } from '../paperless/PaperlessGateway';
import type { QdrantClient } from '@qdrant/js-client-rest';
import type { VectorConfig } from './VectorConfig';
import type { IndexingStateStore } from './IndexingStateStore';
import { EmbeddingRateLimiter, RateLimitError } from './EmbeddingRateLimiter';
import { DocumentIndexer } from './DocumentIndexer';

export interface BatchSchedulerConfig {
  autoEnabled: boolean;
  intervalMinutes: number;
  batchSize: number;
}

export const DEFAULT_SCHEDULER_CONFIG: BatchSchedulerConfig = {
  autoEnabled: false,
  intervalMinutes: 15,
  batchSize: 50,
};

export interface BatchResult {
  processed: number;
  indexed: number;
  skipped: number;
  failed: number;
  rateLimited: number;
  durationMs: number;
  stoppedByRateLimit: boolean;
}

/**
 * Manages automatic background indexing with single-flight execution,
 * configurable intervals, and graceful rate-limit handling.
 */
export class BatchScheduler {
  private readonly indexer: DocumentIndexer;
  private readonly stateStore: IndexingStateStore;
  private readonly config: BatchSchedulerConfig;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private stopped = false;

  constructor(
    indexer: DocumentIndexer,
    stateStore: IndexingStateStore,
    config: Partial<BatchSchedulerConfig> = {},
  ) {
    this.indexer = indexer;
    this.stateStore = stateStore;
    this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
  }

  /** Start the automatic background loop. */
  start(): void {
    if (this.timer || !this.config.autoEnabled) return;
    this.stopped = false;

    const intervalMs = this.config.intervalMinutes * 60_000;
    this.updateNextScheduled(intervalMs);

    this.timer = setInterval(() => {
      this.runBatch().catch((err) =>
        console.error('[batch-scheduler] Unhandled batch error:', err),
      );
    }, intervalMs);

    console.log(
      `[batch-scheduler] Started — interval ${this.config.intervalMinutes}m, batch size ${this.config.batchSize}`,
    );
  }

  /** Stop the background loop. */
  stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.stateStore.setNextScheduledBatch(null);
  }

  isRunning(): boolean {
    return this.running;
  }

  isAutoEnabled(): boolean {
    return this.config.autoEnabled;
  }

  /**
   * Run one indexing batch. Single-flight: overlapping calls are ignored.
   * Safe to call manually from an API endpoint.
   */
  async runBatch(): Promise<BatchResult> {
    if (this.running) {
      return { processed: 0, indexed: 0, skipped: 0, failed: 0, rateLimited: 0, durationMs: 0, stoppedByRateLimit: false };
    }

    this.running = true;
    const start = Date.now();
    const result: BatchResult = {
      processed: 0, indexed: 0, skipped: 0, failed: 0, rateLimited: 0, durationMs: 0, stoppedByRateLimit: false,
    };

    try {
      // Scan Paperless for new/changed documents and sync state
      await this.indexer.scanAndSyncState();

      const retryable = this.stateStore.getRetryableRecords();
      if (retryable.length === 0) {
        this.stateStore.setLastBatch('No pending documents.');
        return result;
      }

      const batch = retryable.slice(0, this.config.batchSize);

      for (const record of batch) {
        if (this.stopped) break;

        try {
          this.stateStore.markInProgress(record.documentId);
          await this.indexer.indexSingleDocument(record.documentId);
          this.stateStore.markIndexed(record.documentId);
          result.indexed++;
        } catch (err: unknown) {
          if (err instanceof RateLimitError) {
            const nextRetry = new Date(Date.now() + err.retryAfterMs).toISOString();
            this.stateStore.markRateLimited(record.documentId, nextRetry, err.message);
            result.rateLimited++;
            result.stoppedByRateLimit = true;

            // Mark remaining batch items as rate-limited too
            const remaining = batch.slice(batch.indexOf(record) + 1);
            for (const r of remaining) {
              this.stateStore.markRateLimited(r.documentId, nextRetry, 'Batch paused: provider rate limit.');
              result.rateLimited++;
            }
            break;
          }

          const msg = err instanceof Error ? err.message : 'Unknown error';
          this.stateStore.markFailed(record.documentId, msg);
          result.failed++;
        }

        result.processed++;
      }

      const summary = result.stoppedByRateLimit
        ? `Batch stopped by rate limit. Indexed: ${result.indexed}, rate-limited: ${result.rateLimited}`
        : `Batch complete. Indexed: ${result.indexed}, failed: ${result.failed}, skipped: ${result.skipped}`;
      this.stateStore.setLastBatch(summary);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.stateStore.setLastBatch(`Batch error: ${msg}`);
      console.error('[batch-scheduler] Batch failed:', err);
    } finally {
      result.durationMs = Date.now() - start;
      this.running = false;
      if (this.config.autoEnabled && !this.stopped) {
        this.updateNextScheduled(this.config.intervalMinutes * 60_000);
      }
      await this.stateStore.flush();
    }

    return result;
  }

  private updateNextScheduled(intervalMs: number): void {
    const next = new Date(Date.now() + intervalMs).toISOString();
    this.stateStore.setNextScheduledBatch(next);
  }
}
