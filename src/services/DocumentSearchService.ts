import type { DocumentSearchResponse } from '../types';

/** Contract for the document search implementation. */
export interface DocumentSearchService {
  searchDocuments(query: string, page?: number): Promise<DocumentSearchResponse>;
}
