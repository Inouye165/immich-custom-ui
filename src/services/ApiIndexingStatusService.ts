import type { IndexingSummary, IndexingRecordsResponse, BatchResult } from '../types';
import type { IndexingStatusService } from './IndexingStatusService';

interface ErrorResponse {
  message?: string;
}

export class ApiIndexingStatusService implements IndexingStatusService {
  async getSummary(): Promise<IndexingSummary> {
    const response = await fetch('/api/indexing/summary');
    if (!response.ok) {
      const payload = (await safeParseJson(response)) as ErrorResponse | null;
      throw new Error(payload?.message?.trim() || 'Failed to fetch indexing summary.');
    }
    return (await response.json()) as IndexingSummary;
  }

  async getRecords(limit = 100, offset = 0): Promise<IndexingRecordsResponse> {
    const url = new URL('/api/indexing/records', window.location.origin);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));

    const response = await fetch(url);
    if (!response.ok) {
      const payload = (await safeParseJson(response)) as ErrorResponse | null;
      throw new Error(payload?.message?.trim() || 'Failed to fetch indexing records.');
    }
    return (await response.json()) as IndexingRecordsResponse;
  }

  async triggerBatch(): Promise<BatchResult> {
    const response = await fetch('/api/indexing/batch', { method: 'POST' });
    if (!response.ok) {
      const payload = (await safeParseJson(response)) as ErrorResponse | null;
      throw new Error(payload?.message?.trim() || 'Failed to trigger indexing batch.');
    }
    return (await response.json()) as BatchResult;
  }
}

async function safeParseJson(resp: Response): Promise<unknown> {
  try {
    return await resp.json();
  } catch {
    return null;
  }
}
