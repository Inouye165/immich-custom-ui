import type { SearchRequest, SearchResponse } from '../types';

/** Contract for any search backend — mock, Immich API, etc. */
export interface SearchService {
  search(request: SearchRequest): Promise<SearchResponse>;
}
