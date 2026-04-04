import { describe, expect, it, vi } from 'vitest';
import { EmbeddingRateLimiter, RateLimitError } from '../vector/EmbeddingRateLimiter';
import type { EmbeddingService } from '../vector/EmbeddingService';

function createMockEmbedding(overrides: Partial<EmbeddingService> = {}): EmbeddingService {
  return {
    embed: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
    dimensions: vi.fn().mockReturnValue(3),
    ...overrides,
  };
}

describe('EmbeddingRateLimiter', () => {
  it('passes through embed calls when under the rate limit', async () => {
    const inner = createMockEmbedding();
    const limiter = new EmbeddingRateLimiter(inner, { requestsPerMinute: 10 });
    const result = await limiter.embed(['hello']);
    expect(result).toEqual([[0.1, 0.2, 0.3]]);
    expect(inner.embed).toHaveBeenCalledWith(['hello'], 'document');
  });

  it('throws RateLimitError when local rate limit is reached', async () => {
    const inner = createMockEmbedding();
    const limiter = new EmbeddingRateLimiter(inner, { requestsPerMinute: 2 });

    await limiter.embed(['a']);
    await limiter.embed(['b']);

    await expect(limiter.embed(['c'])).rejects.toThrow(RateLimitError);
  });

  it('detects provider 429 and enters cooldown', async () => {
    const inner = createMockEmbedding({
      embed: vi.fn().mockRejectedValue(new Error('HTTP 429: Rate limit exceeded')),
    });
    const limiter = new EmbeddingRateLimiter(inner, {
      requestsPerMinute: 100,
      cooldownMinutes: 1,
    });

    await expect(limiter.embed(['test'])).rejects.toThrow(RateLimitError);
    expect(limiter.isCoolingDown()).toBe(true);
  });

  it('throws RateLimitError during cooldown period', async () => {
    const inner = createMockEmbedding({
      embed: vi.fn().mockRejectedValue(new Error('429 Rate limit')),
    });
    const limiter = new EmbeddingRateLimiter(inner, {
      requestsPerMinute: 100,
      cooldownMinutes: 5,
    });

    await expect(limiter.embed(['first'])).rejects.toThrow(RateLimitError);

    // Subsequent calls should immediately fail
    inner.embed = vi.fn().mockResolvedValue([[1, 2, 3]]);
    await expect(limiter.embed(['second'])).rejects.toThrow(RateLimitError);
    expect(inner.embed).not.toHaveBeenCalled();
  });

  it('delegates dimensions() to inner service', () => {
    const inner = createMockEmbedding({ dimensions: vi.fn().mockReturnValue(768) });
    const limiter = new EmbeddingRateLimiter(inner);
    expect(limiter.dimensions()).toBe(768);
  });

  it('RateLimitError carries retryAfterMs', async () => {
    const inner = createMockEmbedding({
      embed: vi.fn().mockRejectedValue(new Error('429 quota exceeded')),
    });
    const limiter = new EmbeddingRateLimiter(inner, {
      requestsPerMinute: 100,
      cooldownMinutes: 2,
    });

    try {
      await limiter.embed(['test']);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterMs).toBeGreaterThan(0);
    }
  });
});
