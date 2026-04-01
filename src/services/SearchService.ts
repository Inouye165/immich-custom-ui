import type { SearchRequest, SearchResponse } from '../types';

/** Contract for the active app search implementation. */
export interface SearchService {
  search(request: SearchRequest): Promise<SearchResponse>;
}
