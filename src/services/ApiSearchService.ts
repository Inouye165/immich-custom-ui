import type { SearchRequest, SearchResponse } from '../types';
import type { SearchService } from './SearchService';

interface ErrorResponse {
  message?: string;
}

export class ApiSearchService implements SearchService {
  async search(request: SearchRequest): Promise<SearchResponse> {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const payload = (await safeParseJson(response)) as ErrorResponse | null;
      throw new Error(payload?.message?.trim() || 'Search request failed.');
    }

    return (await response.json()) as SearchResponse;
  }
}

async function safeParseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
