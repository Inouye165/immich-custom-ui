import { describe, expect, it } from 'vitest';
import { normalizeSearchResponse } from '../search/normalizeSearchResponse';

describe('normalizeSearchResponse', () => {
  it('maps Immich assets into UI search results', () => {
    const response = normalizeSearchResponse({
      albums: null,
      assets: {
        count: 1,
        nextPage: null,
        total: 1,
        items: [
          {
            id: '0d2cbf93-6075-4f8d-bdc3-6f3777eb34ab',
            createdAt: '2024-08-15T12:00:00.000Z',
            fileCreatedAt: '2024-08-15T12:00:00.000Z',
            localDateTime: '2024-08-15T05:00:00.000Z',
            originalFileName: 'sunset.jpg',
            type: 'IMAGE',
            exifInfo: {
              city: 'Seattle',
              state: 'Washington',
              country: 'USA',
            },
          },
        ],
      },
    });

    expect(response.total).toBe(1);
    expect(response.results).toEqual([
      {
        id: '0d2cbf93-6075-4f8d-bdc3-6f3777eb34ab',
        title: 'sunset.jpg',
        thumbnailUrl: '/api/assets/0d2cbf93-6075-4f8d-bdc3-6f3777eb34ab/thumbnail?size=preview',
        date: '2024-08-15T05:00:00.000Z',
        description: 'Photo • Seattle, Washington, USA',
      },
    ]);
  });
});
