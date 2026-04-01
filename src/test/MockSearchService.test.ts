import { describe, it, expect } from 'vitest';
import { MockSearchService } from '../services/MockSearchService';

describe('MockSearchService', () => {
  const service = new MockSearchService();

  it('returns results matching query text', async () => {
    const response = await service.search({ query: 'sunset' });
    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results[0].title.toLowerCase()).toContain('sunset');
  });

  it('returns empty results for non-matching query', async () => {
    const response = await service.search({ query: 'xyznonexistent' });
    expect(response.results).toHaveLength(0);
    expect(response.total).toBe(0);
  });

  it('filters by date range', async () => {
    const response = await service.search({
      query: 'a',
      startDate: '2024-08-01',
      endDate: '2024-08-31',
    });
    for (const r of response.results) {
      expect(r.date >= '2024-08-01').toBe(true);
      expect(r.date <= '2024-08-31').toBe(true);
    }
  });

  it('total matches results length', async () => {
    const response = await service.search({ query: 'mountain' });
    expect(response.total).toBe(response.results.length);
  });
});
