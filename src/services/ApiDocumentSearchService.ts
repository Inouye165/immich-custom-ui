import type { DocumentSearchMode, DocumentSearchResponse } from '../types';
import type { DocumentSearchService } from './DocumentSearchService';

interface ErrorResponse {
  message?: string;
}

export class ApiDocumentSearchService implements DocumentSearchService {
  async searchDocuments(query: string, page = 1, mode?: DocumentSearchMode): Promise<DocumentSearchResponse> {
    const url = new URL('/api/documents/search', window.location.origin);
    url.searchParams.set('query', query);
    if (page > 1) {
      url.searchParams.set('page', String(page));
    }
    if (mode) {
      url.searchParams.set('mode', mode);
    }

    const response = await fetch(url);
    if (!response.ok) {
      const payload = (await safeParseJson(response)) as ErrorResponse | null;
      throw new Error(payload?.message?.trim() || 'Document search failed.');
    }
    return (await response.json()) as DocumentSearchResponse;
  }

  async deleteDocument(id: number): Promise<void> {
    const response = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const payload = (await safeParseJson(response)) as ErrorResponse | null;
      throw new Error(payload?.message?.trim() || 'Failed to delete document.');
    }
  }
}

async function safeParseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
