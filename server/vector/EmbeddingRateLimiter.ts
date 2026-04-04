import type { EmbeddingService } from './EmbeddingService';

export interface RateLimiterConfig {
  requestsPerMinute: number;
  cooldownMinutes: number;
  maxRetries: number;
  backoffBaseMs: number;
  backoffMaxMs: number;
}

export const DEFAULT_RATE_LIMITER_CONFIG: RateLimiterConfig = {
  requestsPerMinute: 10,
  cooldownMinutes: 5,
  maxRetries: 5,
  backoffBaseMs: 2000,
  backoffMaxMs: 120_000,
};

/** Thrown when the provider returns 429 or we exceed our local rate limit. */
export class RateLimitError extends Error {
  readonly retryAfterMs: number;

  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/** Thrown when max retries are exhausted for a document. */
export class MaxRetriesExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MaxRetriesExceededError';
  }
}

function jitter(ms: number): number {
  return ms * (0.5 + Math.random() * 0.5);
}

/**
 * Wraps an EmbeddingService with sliding-window rate limiting,
 * exponential backoff, jitter, and 429 detection.
 */
export class EmbeddingRateLimiter {
  private readonly inner: EmbeddingService;
  private readonly config: RateLimiterConfig;
  private readonly timestamps: number[] = [];
  private coolingUntil = 0;

  constructor(inner: EmbeddingService, config: Partial<RateLimiterConfig> = {}) {
    this.inner = inner;
    this.config = { ...DEFAULT_RATE_LIMITER_CONFIG, ...config };
  }

  /** Returns true when in a provider-triggered cooldown period. */
  isCoolingDown(): boolean {
    return Date.now() < this.coolingUntil;
  }

  cooldownEndsAt(): number {
    return this.coolingUntil;
  }

  /**
   * Embed with rate limiting.
   * Throws RateLimitError if the provider rate-limits us.
   * Throws MaxRetriesExceededError if retries are exhausted.
   */
  async embed(texts: string[], retryCount = 0): Promise<number[][]> {
    if (this.isCoolingDown()) {
      const waitMs = this.coolingUntil - Date.now();
      throw new RateLimitError(
        `Cooling down for ${Math.ceil(waitMs / 1000)}s after provider rate limit.`,
        waitMs,
      );
    }

    // Sliding window: remove timestamps older than 60s
    const now = Date.now();
    const windowStart = now - 60_000;
    while (this.timestamps.length > 0 && this.timestamps[0] < windowStart) {
      this.timestamps.shift();
    }

    // If at capacity, wait until the oldest request exits the window
    if (this.timestamps.length >= this.config.requestsPerMinute) {
      const waitMs = this.timestamps[0] - windowStart + 50;
      throw new RateLimitError(
        `Local rate limit reached (${this.config.requestsPerMinute} req/min). Wait ${Math.ceil(waitMs / 1000)}s.`,
        waitMs,
      );
    }

    this.timestamps.push(now);

    try {
      return await this.inner.embed(texts);
    } catch (err: unknown) {
      const is429 = this.isRateLimitResponse(err);
      if (is429) {
        const retryAfterMs = this.extractRetryAfter(err) ??
          this.config.cooldownMinutes * 60_000;
        this.coolingUntil = Date.now() + retryAfterMs;
        throw new RateLimitError(
          `Provider returned 429. Cooling down for ${Math.ceil(retryAfterMs / 1000)}s.`,
          retryAfterMs,
        );
      }

      // Non-429 transient errors: apply exponential backoff
      if (retryCount < this.config.maxRetries && this.isTransientError(err)) {
        const delay = Math.min(
          jitter(this.config.backoffBaseMs * 2 ** retryCount),
          this.config.backoffMaxMs,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.embed(texts, retryCount + 1);
      }

      throw err;
    }
  }

  dimensions(): number | undefined {
    return this.inner.dimensions();
  }

  private isRateLimitResponse(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const msg = err.message.toLowerCase();
    return msg.includes('429') || msg.includes('rate limit') || msg.includes('quota exceeded');
  }

  private extractRetryAfter(err: unknown): number | null {
    if (!(err instanceof Error)) return null;
    // Try to extract Retry-After seconds from error message
    const match = err.message.match(/retry.?after[:\s]*(\d+)/i);
    if (match) {
      return parseInt(match[1], 10) * 1000;
    }
    return null;
  }

  private isTransientError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const msg = err.message.toLowerCase();
    return msg.includes('500') || msg.includes('502') || msg.includes('503') ||
      msg.includes('timeout') || msg.includes('econnrefused') || msg.includes('econnreset');
  }
}
