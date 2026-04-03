/** Domain types for document search. */

export interface DocumentResult {
  id: number;
  title: string;
  createdDate: string;
  thumbnailUrl: string;
  previewUrl: string;
  snippet?: string;
}

export interface DocumentSearchResponse {
  results: DocumentResult[];
  total: number;
  hasMore: boolean;
}
