import type { DocumentSearchMode, DocumentSearchResponse } from '../types';

/** Contract for the document search implementation. */
export interface DocumentSearchService {
  searchDocuments(query: string, page?: number, mode?: DocumentSearchMode): Promise<DocumentSearchResponse>;
  deleteDocument(id: number): Promise<void>;
}
