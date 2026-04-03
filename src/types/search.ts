/** Domain types for search requests and results. */

import type { DocumentSearchMode } from './document';

export type SearchSource = 'all' | 'photos' | 'documents';

export interface SearchRequest {
  query: string;
  startDate?: string;
  endDate?: string;
  source?: SearchSource;
  documentMode?: DocumentSearchMode;
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
