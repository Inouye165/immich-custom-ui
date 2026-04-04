import type { IndexingStateStore } from './IndexingStateStore';
import { RateLimitError } from './EmbeddingRateLimiter';
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
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
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
    this.clearRetryTimer();
    this.stateStore.setNextScheduledBatch(null);
  }

  isRunning(): boolean {
    return this.running;
  }

  isAutoEnabled(): boolean {
    return this.config.autoEnabled;
  }

  /**
   * Recover a previously scheduled retry from persisted state.
   * This keeps manual indexing flows alive across backend restarts.
   */
  resumePendingRetry(): void {
    if (this.stopped) {
      return;
    }

    const nextScheduledBatch = this.stateStore.getSummary().nextScheduledBatch;
    if (!nextScheduledBatch) {
      return;
    }

    const scheduledAt = new Date(nextScheduledBatch).getTime();
    if (Number.isNaN(scheduledAt)) {
      this.stateStore.setNextScheduledBatch(null);
      return;
    }

    const waitMs = Math.max(scheduledAt - Date.now(), 0);
    this.scheduleRetry(waitMs, false);
  }

  /**
   * Run one indexing batch. Single-flight: overlapping calls are ignored.
   * Safe to call manually from an API endpoint.
   */
  async runBatch(): Promise<BatchResult> {
    if (this.running) {
      return { processed: 0, indexed: 0, skipped: 0, failed: 0, rateLimited: 0, durationMs: 0, stoppedByRateLimit: false };
    }

    this.clearRetryTimer();
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
            this.scheduleRetry(err.retryAfterMs, true);
            break;
          }

          const msg = err instanceof Error ? err.message : 'Unknown error';
          this.stateStore.markFailed(record.documentId, msg);
          result.failed++;
        }

        result.processed++;
      }

      const summary = result.stoppedByRateLimit
        ? `Batch stopped by rate limit. Indexed: ${result.indexed}, rate-limited: ${result.rateLimited}, pending carryover: ${Math.max(batch.length - result.processed, 0)}`
        : `Batch complete. Indexed: ${result.indexed}, failed: ${result.failed}, skipped: ${result.skipped}`;
      this.stateStore.setLastBatch(summary);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.stateStore.setLastBatch(`Batch error: ${msg}`);
      console.error('[batch-scheduler] Batch failed:', err);
    } finally {
      result.durationMs = Date.now() - start;
      this.running = false;
      if (result.stoppedByRateLimit) {
        // A one-off retry has already been scheduled after the provider cooldown.
      } else if (!this.config.autoEnabled && !this.stopped) {
        const remainingRetryable = this.stateStore.getRetryableRecords().length;
        const earliestRetryAt = this.stateStore.getEarliestRetryAt();

        if (remainingRetryable > 0) {
          this.scheduleRetry(1_000, true);
        } else if (earliestRetryAt) {
          this.scheduleRetry(new Date(earliestRetryAt).getTime() - Date.now(), true);
        } else {
          this.stateStore.setNextScheduledBatch(null);
        }
      } else if (this.config.autoEnabled && !this.stopped) {
        this.updateNextScheduled(this.config.intervalMinutes * 60_000);
      } else {
        this.stateStore.setNextScheduledBatch(null);
      }
      await this.stateStore.flush();
    }

    return result;
  }

  private updateNextScheduled(intervalMs: number): void {
    const next = new Date(Date.now() + intervalMs).toISOString();
    this.stateStore.setNextScheduledBatch(next);
  }

  private scheduleRetry(delayMs: number, updateState = true): void {
    if (this.stopped) {
      return;
    }

    const waitMs = Math.max(delayMs, 1_000);
    this.clearRetryTimer();
    if (updateState) {
      const next = new Date(Date.now() + waitMs).toISOString();
      this.stateStore.setNextScheduledBatch(next);
    }
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.runBatch().catch((err) =>
        console.error('[batch-scheduler] Scheduled retry failed:', err),
      );
    }, waitMs);
  }

  private clearRetryTimer(): void {
    if (!this.retryTimer) {
      return;
    }

    clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }
}
