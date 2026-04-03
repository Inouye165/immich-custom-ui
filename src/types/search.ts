/** Domain types for search requests and results. */

export type SearchSource = 'all' | 'photos' | 'documents';

export interface SearchRequest {
  query: string;
  startDate?: string;
  endDate?: string;
  source?: SearchSource;
}

export interface SearchResult {
  id: string;
  title: string;
  thumbnailUrl: string;
  date: string;
  description?: string;
  mediaType?: 'photo' | 'video';
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
}
