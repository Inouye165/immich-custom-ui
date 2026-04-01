import { describe, expect, it } from 'vitest';
import { buildSmartSearchPayload } from '../search/buildSmartSearchPayload';

describe('buildSmartSearchPayload', () => {
  it('shapes query-only requests for Immich smart search', () => {
    const payload = buildSmartSearchPayload({ query: 'beach' });

    expect(payload).toEqual({
      query: 'beach',
      page: 1,
      size: 60,
    });
  });

  it('adds takenAfter and takenBefore for date filters', () => {
    const payload = buildSmartSearchPayload({
      query: 'sunset',
      startDate: '2024-08-01',
      endDate: '2024-08-31',
    });

    expect(payload.query).toBe('sunset');
    expect(payload.takenAfter).toMatch(/^2024-08-01T/);
    expect(payload.takenBefore).toMatch(/^2024-08-31T/);
    expect(payload.page).toBe(1);
    expect(payload.size).toBe(60);
  });
});
