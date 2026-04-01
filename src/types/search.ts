/** Domain types for search requests and results. */

export interface SearchRequest {
  query: string;
  startDate?: string;
  endDate?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  thumbnailUrl: string;
  date: string;
  description: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
}
