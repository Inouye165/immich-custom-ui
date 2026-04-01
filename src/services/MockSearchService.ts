import type { SearchRequest, SearchResponse, SearchResult } from '../types';
import type { SearchService } from './SearchService';

/** Fake data for local development. Replace with ImmichSearchService later. */
const MOCK_RESULTS: SearchResult[] = [
  {
    id: '1',
    title: 'Sunset at the beach',
    thumbnailUrl: 'https://placehold.co/300x200/e2a04f/fff?text=Sunset',
    date: '2024-08-15',
    description: 'Golden hour at the coast.',
  },
  {
    id: '2',
    title: 'Mountain hike',
    thumbnailUrl: 'https://placehold.co/300x200/4f8fe2/fff?text=Mountain',
    date: '2024-07-22',
    description: 'Trail through alpine meadows.',
  },
  {
    id: '3',
    title: 'City skyline',
    thumbnailUrl: 'https://placehold.co/300x200/6a6a6a/fff?text=City',
    date: '2024-06-10',
    description: 'Downtown skyline at dusk.',
  },
  {
    id: '4',
    title: 'Family dinner',
    thumbnailUrl: 'https://placehold.co/300x200/e24f7a/fff?text=Dinner',
    date: '2024-09-01',
    description: 'Holiday gathering at home.',
  },
  {
    id: '5',
    title: 'Garden flowers',
    thumbnailUrl: 'https://placehold.co/300x200/4fe260/fff?text=Flowers',
    date: '2024-05-18',
    description: 'Spring blooms in the backyard.',
  },
];

export class MockSearchService implements SearchService {
  async search(request: SearchRequest): Promise<SearchResponse> {
    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 600));

    const query = request.query.toLowerCase();

    const filtered = MOCK_RESULTS.filter((item) => {
      const matchesQuery =
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query);

      const matchesStart =
        !request.startDate || item.date >= request.startDate;

      const matchesEnd =
        !request.endDate || item.date <= request.endDate;

      return matchesQuery && matchesStart && matchesEnd;
    });

    return { results: filtered, total: filtered.length };
  }
}
